import argparse
from pathlib import Path


def capture_frame(output, device, cv):
    camera = cv.VideoCapture(device)
    try:
        if not camera.isOpened():
            raise RuntimeError("摄像头无法打开，请核对设备、权限和占用")
        ok, frame = camera.read()
        if not ok or frame is None:
            raise RuntimeError("未取得图像帧")
        ok, encoded = cv.imencode(output.suffix.lower(), frame)
        if not ok:
            raise RuntimeError("图像编码失败")
        # Exclusive creation also protects a file created after the CLI precheck.
        with output.open("xb") as stream:
            stream.write(encoded.tobytes())
    finally:
        camera.release()


def main():
    parser = argparse.ArgumentParser(description="从 USB 摄像头保存一张图像")
    parser.add_argument("output", type=Path)
    parser.add_argument("--device", type=int, default=0)
    args = parser.parse_args()
    if args.device < 0:
        parser.error("--device 必须是非负整数")
    if args.output.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
        parser.error("输出扩展名必须是 .jpg、.jpeg 或 .png")
    if args.output.exists() or args.output.is_symlink():
        parser.error("输出已存在，请使用新的文件名")
    if not args.output.parent.is_dir():
        parser.error("输出父目录不存在")
    try:
        import cv2
    except ImportError:
        parser.error("需要 OpenCV；Raspberry Pi OS 可安装 python3-opencv")
    try:
        capture_frame(args.output, args.device, cv2)
    except (OSError, RuntimeError, cv2.error) as error:
        parser.exit(1, f"采集失败：{error}\n")
    print(f"saved: {args.output}")


if __name__ == "__main__":
    main()
