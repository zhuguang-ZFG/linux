#!/usr/bin/env bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
name="linux-course-check-$$-$RANDOM"
image="linux-course-hello:check"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker build -t "$image" "$script_dir/docker-hello"
docker run -d --name "$name" -p 127.0.0.1::8000 "$image" >/dev/null
address=$(docker port "$name" 8000/tcp)
response=$(curl -fsS --retry 15 --retry-connrefused --retry-delay 1 "http://$address/")
[[ "$response" == '你好，来自容器！' ]] || { echo "Unexpected response: $response" >&2; exit 1; }
echo 'PASS: Docker image builds and serves the expected UTF-8 response'
