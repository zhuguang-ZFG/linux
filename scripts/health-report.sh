#!/usr/bin/env bash
# health-report.sh：只读巡检，根文件系统达到阈值时退出码为 1。
set -euo pipefail
threshold=${1:-85}
if [[ ! "$threshold" =~ ^[0-9]{1,3}$ ]]; then
    echo "用法：$0 [磁盘告警百分比，1-100]" >&2
    exit 2
fi
threshold=$((10#$threshold))
if (( threshold < 1 || threshold > 100 )); then
    echo "阈值必须在 1-100 之间" >&2
    exit 2
fi
export LC_ALL=C
printf '=== Linux health report ===\n'
date -u '+UTC: %F %T'
printf 'Host: %s\n' "$(hostname)"
uname -sr
uptime
printf '\n=== Memory ===\n'
if command -v free >/dev/null; then free -h; else echo 'free unavailable'; fi
printf '\n=== Root filesystem ===\n'
df -hP /
df -iP /
usage=$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')
[[ "$usage" =~ ^[0-9]+$ ]] || { echo 'Cannot parse df output' >&2; exit 2; }
printf '\n=== Listening TCP sockets ===\n'
if command -v ss >/dev/null; then ss -ltn; else echo 'ss unavailable'; fi
if (( usage >= threshold )); then
    printf '\nWARN: root filesystem %s%% >= %s%%\n' "$usage" "$threshold"
    exit 1
fi
printf '\nOK: root filesystem %s%% < %s%%\n' "$usage" "$threshold"
