"""Shared bits for the tools: serve dist/ and open it in headless Chrome."""
import functools, http.server, os, socketserver, threading
from contextlib import contextmanager
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


@contextmanager
def served():
    handler = functools.partial(Quiet, directory=DIST)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', 0), handler) as httpd:
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        try:
            yield f'http://127.0.0.1:{httpd.server_address[1]}/'
        finally:
            httpd.shutdown()


@contextmanager
def browser():
    with sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception:
            b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        try:
            yield b
        finally:
            b.close()


def open_app(b, url, w=412, h=915, scale=2.625, query=''):
    pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=scale, accept_downloads=True)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url + query)
    pg.wait_for_function('window.__rstr !== undefined')
    pg.evaluate('() => window.__rstr.ready')
    pg.wait_for_timeout(100)
    return pg, errors
