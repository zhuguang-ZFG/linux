#!/usr/bin/env bash
# health-report.sh：只读巡检，根文件系统达到阈值时退出码为 1。
set -euo pipefail
die() { echo "ERROR: $*" >&2; exit 2; }
usage_help() { echo "用法：$0 [磁盘告警百分比，1-100]"; }
[[ $# -le 1 ]] || { usage_help >&2; exit 2; }
if [[ ${1-} == --help ]]; then usage_help; exit 0; fi
threshold=${1-85}
if [[ ! "$threshold" =~ ^[0-9]{1,3}$ ]]; then
    usage_help >&2
    exit 2
fi
threshold=$((10#$threshold))
if (( threshold < 1 || threshold > 100 )); then
    echo "阈值必须在 1-100 之间" >&2
    exit 2
fi
export LC_ALL=C
for tool in date hostname uname uptime df awk; do
    command -v "$tool" >/dev/null || die "required command unavailable: $tool"
done
checked() { "$@" || die "collection failed: $*"; }
printf '=== Linux health report ===\n'
checked date -u '+UTC: %F %T'
host_name=$(hostname) || die 'cannot read hostname'
printf 'Host: %s\n' "$host_name"
checked uname -sr
checked uptime
printf '\n=== Memory ===\n'
if command -v free >/dev/null; then checked free -h; else echo 'free unavailable'; fi
printf '\n=== Root filesystem ===\n'
checked df -hP /
checked df -iP /
usage=$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}') || die 'cannot read root filesystem usage'
[[ "$usage" =~ ^[0-9]+$ ]] || die 'cannot parse df output'
usage=$((10#$usage))
printf '\n=== Listening TCP sockets ===\n'
if command -v ss >/dev/null; then checked ss -ltn; else echo 'ss unavailable'; fi
if (( usage >= threshold )); then
    printf '\nWARN: root filesystem %s%% >= %s%%\n' "$usage" "$threshold"
    exit 1
fi
printf '\nOK: root filesystem %s%% < %s%%\n' "$usage" "$threshold"
