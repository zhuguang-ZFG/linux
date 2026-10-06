"""Offline media/provenance checks and tests of the explicitly simulated GPIO recorder."""
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


class MediaTests(unittest.TestCase):
    def test_animation_catalog_and_xml(self):
        folder = ROOT / "assets" / "animations"
        catalog = json.loads((folder / "catalog.json").read_text(encoding="utf-8"))
        names = [entry["file"] for entry in catalog]
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(set(names), {file.name for file in folder.glob("*.svg")})
        for entry in catalog:
            with self.subTest(file=entry["file"]):
                svg = ET.parse(folder / entry["file"]).getroot()
                self.assertEqual(svg.tag, "{http://www.w3.org/2000/svg}svg")
                self.assertTrue(svg.get("aria-label") or svg.get("aria-labelledby"))
                self.assertTrue((ROOT / entry["chapter"]).is_file())

    def test_generated_animations_match_source_and_support_reduced_motion(self):
        spec = importlib.util.spec_from_file_location("animations", ROOT / "scripts" / "build-animations.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for scene in module.SCENES:
            with self.subTest(scene=scene[0]):
                actual = (ROOT / "assets" / "animations" / f"{scene[0]}.svg").read_text(encoding="utf-8")
                self.assertEqual(actual, module.render(*scene))
                self.assertIn("prefers-reduced-motion:reduce", actual)

    def test_new_photo_bytes_and_attribution_match_manifest(self):
        folder = ROOT / "assets" / "images"
        records = json.loads((folder / "SOURCES.json").read_text(encoding="utf-8"))
        credits = (folder / "CREDITS.md").read_text(encoding="utf-8")
        self.assertEqual(len(records), 6)
        self.assertEqual(len({r["file"] for r in records}), 6)
        for record in records:
            with self.subTest(file=record["file"]):
                data = (folder / record["file"]).read_bytes()
                self.assertTrue(data.startswith(b"\xff\xd8") and data.endswith(b"\xff\xd9"))
                self.assertEqual(hashlib.sha256(data).hexdigest(), record["sha256"])
                self.assertIn(f'`{record["file"]}`', credits)
                self.assertTrue(record["source"].startswith("https://commons.wikimedia.org/wiki/File:"))
                self.assertTrue(record["author"] and record["license"] and record["changes"])

    def test_all_local_photos_have_credit_entries(self):
        folder = ROOT / "assets" / "images"
        credits = (folder / "CREDITS.md").read_text(encoding="utf-8")
        for file in folder.iterdir():
            if file.suffix in {".jpg", ".png", ".jpeg", ".webp"}:
                self.assertIn(f'`{file.name}`', credits)


class RecorderTests(unittest.TestCase):
    def run_recorder(self, *args):
        return subprocess.run([sys.executable, "-X", "utf8", "-B", str(ROOT / "scripts/pi/record-button.py"), *map(str, args)],
                              capture_output=True, text=True, encoding="utf-8", timeout=10)

    def test_simulation_is_deterministic_and_explicitly_labelled(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "events.csv"
            result = self.run_recorder(output, "--simulate", "--seconds", "2")
            self.assertEqual(result.returncode, 0, result.stderr)
            with output.open(encoding="utf-8", newline="") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual([r["elapsed_s"] for r in rows], ["0.000", "0.500", "1.000", "1.500", "2.000"])
            self.assertEqual([r["state"] for r in rows], ["released", "pressed", "released", "pressed", "released"])
            self.assertEqual({r["source"] for r in rows}, {"simulated"})

    def test_existing_output_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "events.csv"
            output.write_text("keep original", encoding="utf-8")
            result = self.run_recorder(output, "--simulate")
            self.assertEqual(result.returncode, 2)
            self.assertIn("输出已存在", result.stderr)
            self.assertEqual(output.read_text(encoding="utf-8"), "keep original")

    def test_invalid_duration_does_not_create_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            for value in ["0", "-1", "nan", "inf", "3601"]:
                with self.subTest(value=value):
                    output = Path(tmp) / f"{value}.csv"
                    result = self.run_recorder(output, "--simulate", "--seconds", value)
                    self.assertEqual(result.returncode, 2)
                    self.assertIn("--seconds", result.stderr)
                    self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
