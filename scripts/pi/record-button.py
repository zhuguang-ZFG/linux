"""Record button state changes as CSV, with an explicitly labelled simulation mode."""
import argparse
import csv
import math
from pathlib import Path
import time


def main():
    parser = argparse.ArgumentParser(description="记录 GPIO27 按钮状态变化；模拟数据会明确标注")
    parser.add_argument("output", type=Path)
    parser.add_argument("--seconds", type=float, default=5)
    parser.add_argument("--simulate", action="store_true")
    args = parser.parse_args()
    if not math.isfinite(args.seconds) or not 0.1 <= args.seconds <= 3600:
        parser.error("--seconds 必须在 0.1 到 3600 之间")
    if args.output.exists():
        parser.error("输出已存在，请选择新文件名")
    button = None
    if not args.simulate:
        try:
            from gpiozero import Button
        except ImportError:
            parser.error("真机模式需要 gpiozero；无硬件请加 --simulate")
        button = Button(27, pull_up=True, bounce_time=0.05)
    try:
        with args.output.open("x", encoding="utf-8", newline="") as stream:
            writer = csv.writer(stream)
            writer.writerow(["elapsed_s", "state", "source"])
            if args.simulate:
                for i in range(int(args.seconds * 2) + 1):
                    writer.writerow([f"{i / 2:.3f}", "pressed" if i % 2 else "released", "simulated"])
            else:
                start = time.monotonic()
                previous = None
                while time.monotonic() - start < args.seconds:
                    state = "pressed" if button.is_pressed else "released"
                    if state != previous:
                        writer.writerow([f"{time.monotonic() - start:.3f}", state, "gpio27"])
                        stream.flush()
                        previous = state
                    time.sleep(0.02)
    finally:
        if button is not None:
            button.close()
    print(f"Saved {args.output} ({'simulation' if args.simulate else 'GPIO27'})")


if __name__ == "__main__":
    main()
