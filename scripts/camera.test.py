"""Exercise camera lifecycle and filesystem behavior using a fake camera, not hardware."""
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parent / "pi" / "capture-frame.py"
spec = importlib.util.spec_from_file_location("capture", SOURCE)
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


class Camera:
    def __init__(self, opened=True, frame=True):
        self.opened, self.frame, self.released = opened, frame, False

    def isOpened(self):
        return self.opened

    def read(self):
        return self.frame, object() if self.frame else None

    def release(self):
        self.released = True


def fake_cv(camera, encoding=True):
    return SimpleNamespace(VideoCapture=lambda device: camera,
                           imencode=lambda suffix, frame: (encoding, SimpleNamespace(tobytes=lambda: b"encoded image")))


class CameraTests(unittest.TestCase):
    def test_success_writes_encoded_bytes_and_releases_camera(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "frame.png"
            camera = Camera()
            capture.capture_frame(output, 0, fake_cv(camera))
            self.assertEqual(output.read_bytes(), b"encoded image")
            self.assertTrue(camera.released)

    def test_unavailable_camera_is_released_without_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "frame.png"
            camera = Camera(opened=False)
            with self.assertRaises(RuntimeError):
                capture.capture_frame(output, 0, fake_cv(camera))
            self.assertTrue(camera.released)
            self.assertFalse(output.exists())

    def test_failed_frame_is_not_saved(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "frame.png"
            camera = Camera(frame=False)
            with self.assertRaises(RuntimeError):
                capture.capture_frame(output, 0, fake_cv(camera))
            self.assertTrue(camera.released)
            self.assertFalse(output.exists())

    def test_encoding_failure_is_not_saved(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "frame.png"
            camera = Camera()
            with self.assertRaises(RuntimeError):
                capture.capture_frame(output, 0, fake_cv(camera, encoding=False))
            self.assertTrue(camera.released)
            self.assertFalse(output.exists())

    def test_file_created_during_capture_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "frame.png"
            camera = Camera()
            cv = fake_cv(camera)
            def encode(suffix, frame):
                output.write_bytes(b"another writer's image")
                return True, SimpleNamespace(tobytes=lambda: b"new image")
            cv.imencode = encode
            with self.assertRaises(FileExistsError):
                capture.capture_frame(output, 0, cv)
            self.assertEqual(output.read_bytes(), b"another writer's image")
            self.assertTrue(camera.released)

    def test_help_does_not_require_opencv(self):
        with patch.object(sys, "argv", ["capture-frame.py", "--help"]), patch.dict(sys.modules, {"cv2": None}), redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit) as result:
                capture.main()
            self.assertEqual(result.exception.code, 0)

    def test_invalid_extension_is_rejected_before_dependency_loading(self):
        with patch.object(sys, "argv", ["capture-frame.py", "file.txt"]), patch.dict(sys.modules, {"cv2": None}), redirect_stderr(io.StringIO()) as errors:
            with self.assertRaises(SystemExit) as result:
                capture.main()
            self.assertEqual(result.exception.code, 2)
            self.assertIn("扩展名", errors.getvalue())

    def test_missing_dependency_has_an_actionable_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(sys, "argv", ["capture-frame.py", str(Path(tmp) / "frame.jpg")]), patch.dict(sys.modules, {"cv2": None}), redirect_stderr(io.StringIO()) as errors:
                with self.assertRaises(SystemExit) as result:
                    capture.main()
                self.assertEqual(result.exception.code, 2)
                self.assertIn("python3-opencv", errors.getvalue())


if __name__ == "__main__":
    unittest.main()
