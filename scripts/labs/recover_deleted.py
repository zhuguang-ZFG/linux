"""Linux-only demonstration: recover our own unlinked file through an open descriptor."""
import argparse
import hashlib
import json
from pathlib import Path
import sys


def demonstrate(output):
    # Refuse existing directories so the demonstration never reuses user data.
    output.mkdir()
    original = output / "deleted.txt"
    restored = output / "restored.txt"
    payload = b"hello from an open file\n"
    original.write_bytes(payload)
    with original.open("rb") as held:
        descriptor = Path("/proc/self/fd") / str(held.fileno())
        original.unlink()
        recovered = descriptor.read_bytes()
        if recovered != payload:
            raise RuntimeError("Recovered content differs from the source")
        restored.write_bytes(recovered)
    return {
        "original_exists": original.exists(),
        "restored": str(restored.resolve()),
        "bytes": len(recovered),
        "sha256": hashlib.sha256(recovered).hexdigest(),
        "verified": True,
    }


def main():
    parser = argparse.ArgumentParser(description="在全新目录中演示打开文件被删除后的恢复")
    parser.add_argument("output", type=Path, help="尚不存在的实验目录，父目录需已存在")
    args = parser.parse_args()
    if not sys.platform.startswith("linux") or not Path("/proc/self/fd").is_dir():
        parser.error("此实验需要 Linux /proc；Windows 请在 WSL 或 Linux 虚拟机中运行")
    try:
        result = demonstrate(args.output)
    except OSError as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
