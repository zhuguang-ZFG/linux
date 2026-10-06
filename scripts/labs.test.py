"""Run filesystem demonstrations in isolated directories on Linux."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parent / "labs" / "recover_deleted.py"


@unittest.skipUnless(sys.platform.startswith("linux"), "requires Linux /proc; covered on the Ubuntu CI runner")
class RecoveryTests(unittest.TestCase):
    def run_demo(self, output):
        return subprocess.run([sys.executable, "-X", "utf8", "-B", str(SCRIPT), str(output)],
                              capture_output=True, text=True, encoding="utf-8", timeout=10)

    def test_deleted_file_is_restored_and_verified(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "recovery with spaces"
            result = self.run_demo(output)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertTrue(report["verified"])
            self.assertFalse(report["original_exists"])
            self.assertEqual((output / "restored.txt").read_bytes(), b"hello from an open file\n")
            self.assertEqual(report["bytes"], 24)
            self.assertEqual(sorted(p.name for p in output.iterdir()), ["restored.txt"])

    def test_existing_directory_and_file_are_not_modified(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "existing"
            output.mkdir()
            sentinel = output / "deleted.txt"
            sentinel.write_text("user data", encoding="utf-8")
            result = self.run_demo(output)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "user data")
            self.assertEqual(sorted(p.name for p in output.iterdir()), ["deleted.txt"])

    def test_documented_compression_sequence_keeps_source_and_roundtrips(self):
        chapter = SCRIPT.parents[2] / "docs/01-basics/04-压缩与归档.md"
        section = chapter.read_text(encoding="utf-8").split("### gzip 家族：单文件压缩", 1)[1]
        block = re.search(r"```bash\n(.*?)```", section, re.S).group(1)
        # Dependencies are supplied by CI; run the exact lesson after that line.
        self.assertTrue(block.startswith("sudo apt install gzip bzip2 xz-utils\n"))
        commands = block.split("\n", 1)[1]
        with tempfile.TemporaryDirectory() as tmp:
            commands += '\ntest -f "$compression_lab/big.log"\n'
            commands += 'bzip2 -dc "$compression_lab/big.log.bz2" | cmp "$compression_lab/big.log" -\n'
            commands += 'xz -dc "$compression_lab/big.log.xz" | cmp "$compression_lab/big.log" -\n'
            result = subprocess.run(["bash", "-euo", "pipefail", "-c", commands],
                                    env={**os.environ, "TMPDIR": tmp}, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("Linux compression example", result.stdout)


if __name__ == "__main__":
    unittest.main()
