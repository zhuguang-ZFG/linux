"""Run filesystem demonstrations in isolated directories on Linux."""
import json
import configparser
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parent / "labs" / "recover_deleted.py"
ROOT = SCRIPT.parents[2]


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


@unittest.skipUnless(sys.platform.startswith("linux"), "requires GNU tools; covered on the Ubuntu CI runner")
class TextAndScheduleTests(unittest.TestCase):
    def sed_block(self, heading):
        text = (ROOT / "docs/02-advanced/03-sed流编辑器.md").read_text(encoding="utf-8").split(heading, 1)[1]
        return re.search(r"```bash\n(.*?)```", text, re.S).group(1)

    def test_documented_ip_extraction_preserves_the_first_octet(self):
        block = self.sed_block("#### 案例三：从文本中提取 IP")
        result = subprocess.run(["bash", "-euo", "pipefail", "-c", block], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "192.168.10.5")

    def test_batch_replacement_handles_spaces_quotes_and_keeps_original_backups(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / "conf.d"
            directory.mkdir()
            for name in ["space name.conf", "single'quote.conf", "line\nbreak.conf"]:
                (directory / name).write_text("listen 8080;\n", encoding="utf-8")
            (directory / "leave.txt").write_text("8080", encoding="utf-8")
            result = subprocess.run(["bash", "-euo", "pipefail", "-c", self.sed_block("#### 案例一：批量改配置文件")],
                                    cwd=tmp, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            for file in directory.glob("*.conf"):
                self.assertEqual(file.read_text(), "listen 9090;\n")
                self.assertEqual(Path(str(file) + ".bak").read_text(), "listen 8080;\n")
            self.assertEqual((directory / "leave.txt").read_text(), "8080")

    def test_empty_config_directory_is_a_successful_no_op(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "conf.d").mkdir()
            result = subprocess.run(["bash", "-euo", "pipefail", "-c", self.sed_block("#### 案例一：批量改配置文件")],
                                    cwd=tmp, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(list((Path(tmp) / "conf.d").iterdir()), [])

    def schedule_document(self):
        return (ROOT / "docs/03-pro/05-自动化运维.md").read_text(encoding="utf-8")

    def test_documented_units_match_the_installable_sources(self):
        blocks = re.findall(r"```ini\n(.*?)```", self.schedule_document(), re.S)
        for name in ["linux-course-backup.service", "linux-course-backup.timer"]:
            with self.subTest(unit=name):
                block = next(block for block in blocks if block.startswith(f"# ~/.config/systemd/user/{name}\n"))
                documented = configparser.ConfigParser(interpolation=None)
                documented.read_string(block)
                installed = configparser.ConfigParser(interpolation=None)
                installed.read(ROOT / "scripts/scheduling" / name)
                self.assertEqual({k: dict(v) for k, v in documented.items()}, {k: dict(v) for k, v in installed.items()})

    def prepare_schedule(self, tmp):
        task_root = Path(tmp) / "learner home"
        binary = task_root / ".local/bin/linux-course-backup"
        binary.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / "scripts/backup.sh", binary)
        binary.chmod(0o755)
        source = task_root / "linux-backup-lab/source"
        source.mkdir(parents=True)
        (source / "example.txt").write_text("scheduled backup demo\n", encoding="utf-8")
        (task_root / ".local/state/linux-course-backup").mkdir(parents=True)
        return task_root

    def test_user_service_command_passes_both_paths_and_creates_an_archive(self):
        unit = configparser.ConfigParser(interpolation=None)
        unit.read(ROOT / "scripts/scheduling/linux-course-backup.service")
        with tempfile.TemporaryDirectory() as tmp:
            task_root = self.prepare_schedule(tmp)
            command = [part.replace("%h", str(task_root)) for part in shlex.split(unit["Service"]["ExecStart"])]
            result = subprocess.run(command, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(len(list((task_root / "linux-backup-lab/archives").glob("backup_*.tar.gz"))), 1)

    def test_cron_command_uses_writable_log_and_handles_home_path_spaces(self):
        line = next(line for line in self.schedule_document().splitlines() if line.startswith("30 3 * * * "))
        command = line.split(maxsplit=5)[5]
        with tempfile.TemporaryDirectory() as tmp:
            task_root = self.prepare_schedule(tmp)
            # Substitute only the documented HOME reference, not the process's real HOME.
            command = command.replace("$HOME", "$COURSE_TEST_HOME")
            result = subprocess.run(["bash", "-euo", "pipefail", "-c", command],
                                    env={**os.environ, "COURSE_TEST_HOME": str(task_root), "PATH": "/usr/bin:/bin"},
                                    capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(len(list((task_root / "linux-backup-lab/archives").glob("backup_*.tar.gz"))), 1)
            log = task_root / ".local/state/linux-course-backup/backup.log"
            self.assertIn("备份完成", log.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
