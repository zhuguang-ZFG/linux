from pathlib import Path
import argparse

import cv2


def main():
    parser = argparse.ArgumentParser(description="从 USB 摄像头保存一张图像")
    parser.add_argument("output", type=Path)
    parser.add_argument("--device", type=int, default=0)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("输出已存在，请使用新的文件名")
    camera = cv2.VideoCapture(args.device)
    try:
        if not camera.isOpened():
            raise SystemExit("摄像头无法打开，请核对设备、权限和占用")
        ok, frame = camera.read()
        if not ok or frame is None:
            raise SystemExit("未取得图像帧")
        if not cv2.imwrite(str(args.output), frame):
            raise SystemExit("图像保存失败")
        print(f"saved: {args.output}")
    finally:
        camera.release()


if __name__ == "__main__":
    main()
