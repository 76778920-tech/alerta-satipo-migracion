"""Regression checks for public URLs after moving sources into frontend/."""
import importlib.util
from pathlib import Path
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('static_server', ROOT / 'scripts/serve.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass


class PublicRoutesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def test_frontend_files_keep_their_public_urls(self):
        for source in (ROOT / 'frontend').rglob('*'):
            if not source.is_file() or source.is_relative_to(ROOT / 'frontend/src'):
                continue
            route = '/' + source.relative_to(ROOT / 'frontend').as_posix()
            with self.subTest(route=route), urlopen(self.base + route) as response:
                self.assertEqual(response.read(), source.read_bytes())

    def test_directory_entry_points(self):
        for route, source in [('/', 'index.html'), ('/web/', 'web/index.html'), ('/mobile/', 'mobile/index.html')]:
            with self.subTest(route=route), urlopen(self.base + route) as response:
                self.assertEqual(response.read(), (ROOT / 'frontend' / source).read_bytes())

    def test_data_and_documentation_keep_their_urls(self):
        for route in ['/data/smoke_detection_300.json', '/docs/wireframes/index.html']:
            with self.subTest(route=route), urlopen(self.base + route) as response:
                self.assertEqual(response.read(), (ROOT / route.lstrip('/')).read_bytes())

    def test_private_paths_and_traversal_are_not_served(self):
        for route in ['/.', '/.env', '/config/admin.local.json', '/backend/bootstrap.mjs',
                      '/frontend/web/index.html', '/src/bootstrap/backend.mjs', '/data-private/seed.sql', '/shared/js/',
                      '/web/../../backend/bootstrap.mjs', '/web/%2e%2e/%2e%2e/.env',
                      '/docs/../backend/bootstrap.mjs', '/web/..%5c..%5c.env']:
            with self.subTest(route=route), self.assertRaises(HTTPError) as error:
                urlopen(self.base + route)
            self.assertEqual(error.exception.code, 404)


if __name__ == '__main__':
    unittest.main()
