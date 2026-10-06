#!/usr/bin/env bash
# backup.sh：归档成功后保留最近 5 份备份；--dry-run 不写入文件。
set -euo pipefail

usage() { echo "用法：$0 [--dry-run] <源目录> <备份目录>"; }
die() { echo "错误：$*" >&2; exit 1; }
dry_run=0
if [[ ${1:-} == --dry-run ]]; then dry_run=1; shift; fi
if [[ ${1:-} == --help ]]; then usage; exit 0; fi
[[ $# -eq 2 ]] || { usage >&2; exit 1; }
for tool in realpath tar find sort mktemp date mv rm; do
    command -v "$tool" >/dev/null || die "缺少命令：$tool"
done

src=$(realpath -e -- "$1")
[[ -d "$src" ]] || die "源目录不存在：$1"
dst=$(realpath -m -- "$2")
[[ ! -e "$dst" || -d "$dst" ]] || die "备份目标不是目录：$dst"
# 禁止把备份放回源目录，否则会把旧备份再次打包。
[[ "$src" != / && "$dst" != "$src" && "$dst" != "$src/"* ]] \
    || die "备份目录必须位于源目录之外；本脚本不用于整机根目录备份"

KEEP=5
archive="$dst/backup_$(date -u +%Y%m%dT%H%M%S%NZ)_${BASHPID}.tar.gz"
tmp=""
index=""
locked=0
cleanup() {
    [[ -z "$tmp" ]] || rm -f -- "$tmp"
    [[ -z "$index" ]] || rm -f -- "$index"
    if (( locked )); then rmdir -- "$dst/.backup.lock"; fi
    return 0
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# NUL 分隔保留空格、换行等字符。列表只含目标目录直属的普通归档文件。
list_archives() {
    find "$dst" -maxdepth 1 -type f -name 'backup_*.tar.gz' \
        -printf '%T@ %p\0' | sort -z -nr
}

if (( dry_run )); then
    printf '[预演] 将创建：%s\n' "$archive"
    # 新备份将占一个位置，因此旧备份只能再保留 KEEP - 1 份。
    count=0
    if [[ -d "$dst" ]]; then
        # 进程替换异步执行，必须单独等待它，避免把扫描失败误当空列表。
        exec {archive_fd}< <(list_archives)
        scan_pid=$!
        while IFS= read -r -d '' entry; do
            count=$((count + 1))
            if (( count >= KEEP )); then
                printf '[预演] 将删除：%s\n' "${entry#* }"
            fi
        done <&"$archive_fd"
        exec {archive_fd}<&-
        wait "$scan_pid" || die "无法完整读取备份目录，预演结果无效"
    fi
    exit 0
fi

mkdir -p -- "$dst"
# 同一备份目录只允许一个写入者；锁已存在时退出，不清理别人的锁。
mkdir -- "$dst/.backup.lock" 2>/dev/null \
    || die "备份目录正在使用或留有旧锁：$dst/.backup.lock"
locked=1
[[ ! -e "$archive" ]] || die "同名归档已存在：$archive"
# 临时归档与最终文件在同一目录，成功后通过同一文件系统内的 rename 发布。
tmp=$(mktemp "$dst/.backup.tmp.XXXXXXXX")
index=$(mktemp "$dst/.backup.index.XXXXXXXX")
tar -czf "$tmp" -C "$(dirname -- "$src")" -- "$(basename -- "$src")"
tar -tzf "$tmp" >/dev/null
mv -- "$tmp" "$archive"
tmp=""

# 发布成功后才清理。始终保留本次新备份，再保留最新的 KEEP - 1 份旧备份。
list_archives > "$index"
count=1
while IFS= read -r -d '' entry; do
    file=${entry#* }
    [[ "$file" != "$archive" ]] || continue
    count=$((count + 1))
    if (( count > KEEP )); then
        printf '删除旧备份：%s\n' "$file"
        rm -- "$file"
    fi
done < "$index"
printf '备份完成：%s\n' "$archive"
