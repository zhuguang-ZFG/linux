"""Validate Python syntax and the real HTTP response without requiring Docker."""

import ast
import importlib.util
from pathlib import Path
from http.server import HTTPServer
import threading
import unittest
import urllib.request


ROOT = Path(__file__).resolve().parent


class ExampleTests(unittest.TestCase):
    def test_python_sources_parse(self):
        for source in ROOT.rglob("*.py"):
            with self.subTest(source=source.name):
                ast.parse(source.read_text(encoding="utf-8"), filename=str(source))

    def test_http_example_returns_expected_utf8_body(self):
        spec = importlib.util.spec_from_file_location("docker_hello", ROOT / "docker-hello" / "app.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        server = HTTPServer(("127.0.0.1", 0), module.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/"
            # Ignore machine proxy settings for a strictly local test.
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(url, timeout=5) as response:
                self.assertEqual(response.status, 200)
                body = response.read()
                self.assertEqual(body.decode("utf-8"), "你好，来自容器！\n")
                self.assertEqual(response.headers.get_content_charset(), "utf-8")
                self.assertEqual(int(response.headers["Content-Length"]), len(body))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
