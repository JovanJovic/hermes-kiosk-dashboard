"""Hermes kiosk: a bounded, read-only loopback aggregator. Python 3.11 stdlib only."""
import argparse
from collections import deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
from pathlib import Path
import re
import threading
import time
from urllib.error import HTTPError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parent.parent / 'dist'
UPSTREAM = 'http://127.0.0.1:9119'
ALLOWED = frozenset(('/', '/api/status', '/api/sessions?limit=20&offset=0&order=recent', '/api/cron/jobs'))
MAX_BYTES = 2 * 1024 * 1024
TOKEN_PATTERN = re.compile(r'window\.__HERMES_SESSION_TOKEN__\s*=\s*("(?:[^"\\]|\\.)*")')
EXPECTED_PLATFORMS = ('telegram', 'webhook', 'notetaker:telegram')


class UpstreamError(Exception):
    """Deliberately contains no upstream response or credentials."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise UpstreamError('Redirect refused')


class Client:
    def __init__(self):
        self.token = None
        self.retired_tokens = deque(maxlen=4)
        self.opener = build_opener(ProxyHandler({}), NoRedirect())

    def request(self, path, authenticated=False):
        if path not in ALLOWED:
            raise UpstreamError('Endpoint refused')
        headers = {'Accept': 'text/html' if path == '/' else 'application/json'}
        if authenticated:
            headers['X-Hermes-Session-Token'] = self.token or ''
        request = Request(UPSTREAM + path, headers=headers, method='GET')
        with self.opener.open(request, timeout=2) as response:
            body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise UpstreamError('Response too large')
        return body.decode('utf-8')

    def refresh_token(self):
        html = self.request('/')
        match = TOKEN_PATTERN.search(html)
        if not match:
            self.token = None
            raise UpstreamError('Loopback token unavailable')
        token = json.loads(match.group(1))
        if not isinstance(token, str) or not 8 <= len(token) <= 512 or '\n' in token or '\r' in token:
            raise UpstreamError('Invalid loopback token')
        if self.token:
            self.retired_tokens.append(self.token)
        self.token = token

    def get(self, path):
        if path not in ALLOWED or path == '/':
            raise UpstreamError('Endpoint refused')
        protected = path != '/api/status'
        if protected and self.token is None:
            self.refresh_token()
        try:
            body = self.request(path, protected)
        except HTTPError as error:
            if not protected or error.code != 401:
                raise UpstreamError('Upstream unavailable') from None
            # Exactly one refresh/retry for this request, never an auth retry loop.
            self.refresh_token()
            body = self.request(path, True)
        return json.loads(body)

    def text(self, value, fallback='Unknown', limit=160):
        if not isinstance(value, (str, int, float)) or isinstance(value, bool):
            return fallback
        text = str(value)
        for token in [self.token, *self.retired_tokens]:
            if token:
                text = text.replace(token, '[redacted]')
        text = re.sub(r'(?:gh[pousr]_[\w-]{20,}|github_pat_[\w-]{20,}|sk-[\w-]{16,}|\d{8,12}:[\w-]{25,})', '[redacted]', text)
        text = re.sub(r'(?i)(?:bearer\s+|(?:api[_ -]?key|token|password|secret)\s*[=:]\s*)[^\s,;]+', '[redacted]', text)
        return ''.join(c for c in text if c >= ' ' and c != '\x7f')[:limit] or fallback


def stamp(value):
    if isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value) and value > 0:
        return int(value if value > 100_000_000_000 else value * 1000)
    if isinstance(value, str):
        try:
            date = datetime.fromisoformat(value.replace('Z', '+00:00'))
            # A timezone-free upstream value has unknown timezone; don't invent one.
            return int(date.timestamp()*1000) if date.tzinfo else None
        except (ValueError, OverflowError):
            pass
    return None


def normalize_status(raw, client):
    if not isinstance(raw, dict) or not isinstance(raw.get('gateway_platforms'), dict):
        raise UpstreamError('Unexpected status schema')
    platforms = []
    for name in EXPECTED_PLATFORMS:
        data = raw['gateway_platforms'].get(name, {})
        if not isinstance(data, dict):
            data = {}
        code = data.get('error_code')
        safe_code = code if isinstance(code, str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,60}', code) else None
        platforms.append(dict(id=name, state=client.text(data.get('state'), 'unknown', 40), updatedAt=stamp(data.get('updated_at')), error=bool(data.get('error_message') or code), errorCode=client.text(safe_code, '', 60) or None))
    running = raw.get('gateway_running')
    return dict(running=running if type(running) is bool else None, state=client.text(raw.get('gateway_state'),'unknown',40), version=client.text(raw.get('version'), 'Unknown', 30), platforms=platforms)


def normalize_sessions(raw, client):
    if not isinstance(raw, dict) or not isinstance(raw.get('sessions'), list):
        raise UpstreamError('Unexpected sessions schema')
    rows = []
    for row in raw['sessions'][:20]:
        if not isinstance(row, dict) or not isinstance(row.get('id'), str):
            raise UpstreamError('Unexpected session row')
        active = row.get('is_active')
        rows.append(dict(id=client.text(row['id'], limit=180), title=client.text(row.get('title') or row.get('display_name'), 'Untitled session', 100), source=client.text(row.get('source'), 'Unknown', 60), model=client.text(row.get('model'), 'Unknown', 80), startedAt=stamp(row.get('started_at')), lastActive=stamp(row.get('last_active')), endedAt=stamp(row.get('ended_at')), active=active if type(active) is bool else None))
    return rows


def normalize_jobs(raw, client):
    rows = raw if isinstance(raw, list) else raw.get('jobs') if isinstance(raw, dict) else None
    if not isinstance(rows, list):
        raise UpstreamError('Unexpected jobs schema')
    result = []
    for row in rows[:100]:
        if not isinstance(row, dict) or not isinstance(row.get('id'), str):
            raise UpstreamError('Unexpected job row')
        schedule = row.get('schedule') if isinstance(row.get('schedule'), dict) else {}
        enabled = row.get('enabled')
        result.append(dict(id=client.text(row['id'],limit=180), name=client.text(row.get('name'),'Unnamed job',100), enabled=enabled if type(enabled) is bool else None, state=client.text(row.get('state'),'unknown',40), schedule=client.text(row.get('schedule_display') or schedule.get('display') or schedule.get('expr'),'Schedule unavailable',100), nextRun=stamp(row.get('next_run_at')), lastRun=stamp(row.get('last_run_at')), lastStatus=client.text(row.get('last_status'),'unknown',40), error=bool(row.get('last_error') or row.get('last_delivery_error') or row.get('last_fire_error'))))
    return result


class Hub:
    def __init__(self, client=None):
        self.client = client or Client()
        self.lock = threading.Lock()
        self.cache = None
        self.cached_at = 0
        self.events = deque(maxlen=80)
        self.previous = {}
        self.sequence = 0

    def event(self, category, title, detail, now, session_id=None):
        self.sequence += 1
        self.events.appendleft(dict(id=str(self.sequence), category=category, title=title, detail=detail, timestamp=now, sessionId=session_id))

    def sample(self):
        with self.lock:
            if self.cache and time.monotonic() - self.cached_at < 5:
                return self.cache
            now = int(time.time()*1000)
            data = dict(schema=1, source='live', timestamp=now, gateway=None, sessions=[], jobs=[], availability={}, activity=[])
            operations = [('gateway','/api/status',normalize_status), ('sessions','/api/sessions?limit=20&offset=0&order=recent',normalize_sessions), ('jobs','/api/cron/jobs',normalize_jobs)]
            for name, path, normalize in operations:
                try:
                    data[name] = normalize(self.client.get(path), self.client)
                    data['availability'][name] = True
                except Exception:
                    # No raw payloads/exception details are logged or returned.
                    data['availability'][name] = False
                old = self.previous.get(name)
                healthy = data['availability'][name]
                if old is None or old['healthy'] != healthy:
                    self.event('connection', f'{name.capitalize()} '+('connected' if healthy else 'unavailable'), 'Observed by the local hub', now)
                if healthy and name == 'gateway':
                    old_platforms = {p['id']:p for p in old['data']['platforms']} if old and old['healthy'] else {}
                    for p in data[name]['platforms']:
                        before = old_platforms.get(p['id'])
                        if before and (before['state'],before['error']) != (p['state'],p['error']):
                            self.event('platform', p['id'], p['state'] + (' · error reported' if p['error'] else ''), now)
                if healthy and name == 'sessions' and old and old['healthy']:
                    previous_sessions = {s['id']:s for s in old['data']}
                    for session in data[name]:
                        before = previous_sessions.get(session['id'])
                        if before is None or (before['lastActive'],before['active']) != (session['lastActive'],session['active']):
                            self.event('session',session['title'],'Newly observed' if before is None else 'Session metadata changed',now,session['id'])
                if healthy and name == 'jobs' and old and old['healthy']:
                    previous_jobs = {j['id']:j for j in old['data']}
                    for job in data[name]:
                        before = previous_jobs.get(job['id'])
                        if before and (before['lastRun'],before['lastStatus'],before['enabled']) != (job['lastRun'],job['lastStatus'],job['enabled']):
                            self.event('job',job['name'],'Schedule metadata changed',now)
                self.previous[name] = dict(healthy=healthy,data=data[name])
            data['timestamp'] = int(time.time()*1000)
            data['activity'] = list(self.events)
            self.cache, self.cached_at = data, time.monotonic()
            return data


def make_handler(hub):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            authority = self.headers.get('Host','')
            allowed_hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
            origin = self.headers.get('Origin')
            if authority not in allowed_hosts or (origin and origin not in {f'http://{host}' for host in allowed_hosts}):
                self.send_error(403)
                return
            parsed = urlsplit(self.path)
            if parsed.path == '/api/hub' and not parsed.query:
                data = hub.sample()
                self.reply(json.dumps(data,allow_nan=False).encode(), 'application/json')
                return
            if parsed.path.startswith('/api/'):
                self.send_error(404)
                return
            path = (ROOT/(unquote(parsed.path).lstrip('/') or 'index.html')).resolve()
            if not path.is_relative_to(ROOT.resolve()) or not path.is_file():
                self.send_error(404)
                return
            self.reply(path.read_bytes(),mimetypes.guess_type(path)[0] or 'application/octet-stream')

        def reply(self, body, kind):
            self.send_response(200)
            self.send_header('Content-Type',kind)
            self.send_header('Content-Length',str(len(body)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Referrer-Policy','no-referrer')
            self.send_header('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_):
            pass
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=9121)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Use an unprivileged port between 1024 and 65535')
    if not (ROOT/'index.html').is_file():
        parser.error('Missing dist/index.html: install the prebuilt release or run npm ci && npm run build')
    hub = Hub()
    try:
        hub.client.refresh_token()
    except Exception:
        pass  # API can recover later without restarting this service.
    server = ThreadingHTTPServer(('127.0.0.1',args.port),make_handler(hub))
    print(f'Hermes kiosk: http://127.0.0.1:{args.port}/?source=live&view=kiosk',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
