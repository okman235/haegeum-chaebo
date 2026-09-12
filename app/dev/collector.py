# 측정 페이지가 결과를 보내오는 것을 받아 적는 임시 수집기 (개발용, LAN 안에서만)
import http.server, urllib.parse, datetime, sys

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        line = q.get('row', [''])[0]
        if line:
            print(f"{datetime.datetime.now():%H:%M:%S} {line}", flush=True)
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('0.0.0.0', 8899), H).serve_forever()
