#!/usr/bin/env python3
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

mimetypes.add_type("text/javascript", ".jsx")

PORT = int(os.environ.get("COCKPIT_PORT", "9100"))
STATIC = Path(__file__).resolve().parent


class CockpitHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        rel = self.path.split("?")[0].lstrip("/") or "index.html"
        file_path = (STATIC / rel).resolve()
        # Reject path traversal — is_relative_to() compares Path objects, immune to prefix collisions
        if not file_path.is_relative_to(STATIC):
            self.send_response(403)
            self.end_headers()
            return
        if not file_path.is_file():
            self.send_response(404)
            self.end_headers()
            return
        mime = mimetypes.guess_type(str(file_path))[0] or "text/plain"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def main():
    server = HTTPServer(("0.0.0.0", PORT), CockpitHandler)
    print(f"Cockpit on http://0.0.0.0:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
