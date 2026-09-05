from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import hub


class ServerContext:
    def __init__(self, handler):
        self.server = ThreadingHTTPServer(('127.0.0.1',0),handler)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True)
        self.url = f'http://127.0.0.1:{self.server.server_port}'
    def __enter__(self):
        self.thread.start()
        return self
    def __exit__(self,*_):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()


class HubTests(unittest.TestCase):
    def setUp(self):
        self.client = hub.Client()
        self.client.token = secrets.token_urlsafe(32)

    def test_sessions_omit_messages_preview_and_credentials(self):
        raw={'sessions':[{'id':'fixture','title':'Plan '+self.client.token,'source':'telegram','model':'fixture-model','started_at':100,'last_active':200,'is_active':True,'preview':'PRIVATE','messages':[{'content':'PRIVATE'}],'api_key':'PRIVATE'}]}
        result=hub.normalize_sessions(raw,self.client)
        body=json.dumps(result)
        self.assertNotIn('PRIVATE',body)
        self.assertNotIn(self.client.token,body)
        self.assertEqual(result[0]['startedAt'],100000)
        self.assertEqual(result[0]['active'],True)

    def test_jobs_strip_prompt_script_delivery_and_paths(self):
        raw=[{'id':'job','name':'Daily','enabled':True,'next_run_at':'2026-09-06T08:00:00+10:00','schedule':{'expr':'0 8 * * *'},'prompt':'PRIVATE','script':'PRIVATE','deliver':'PRIVATE','workdir':'PRIVATE','last_error':self.client.token}]
        result=hub.normalize_jobs(raw,self.client)
        self.assertNotIn('PRIVATE',json.dumps(result))
        self.assertNotIn(self.client.token,json.dumps(result))
        self.assertTrue(result[0]['error'])
        self.assertEqual(result[0]['schedule'],'0 8 * * *')
        self.assertIsNotNone(result[0]['nextRun'])

    def test_missing_platform_unknown_and_raw_errors_excluded(self):
        result=hub.normalize_status({'gateway_running':False,'gateway_platforms':{'telegram':{'state':'error','error_message':self.client.token,'error_code':'AUTH_ERROR'}}},self.client)
        self.assertFalse(result['running'])
        self.assertEqual(result['platforms'][1]['state'],'unknown')
        self.assertIsNone(result['platforms'][1]['updatedAt'])
        self.assertEqual(result['platforms'][0]['errorCode'],'AUTH_ERROR')
        self.assertNotIn(self.client.token,json.dumps(result))

    def test_unknown_schema_does_not_become_empty_success(self):
        for fn in (hub.normalize_status,hub.normalize_sessions,hub.normalize_jobs):
            with self.assertRaises(hub.UpstreamError):
                fn({'unexpected':[]},self.client)

    def test_timestamp_requires_timezone_and_handles_seconds_ms(self):
        self.assertIsNone(hub.stamp('2026-09-05T12:00:00'))
        self.assertIsNone(hub.stamp(float('nan')))
        self.assertIsNone(hub.stamp(True))
        self.assertEqual(hub.stamp(1700000000),1700000000000)
        self.assertEqual(hub.stamp(1700000000000),1700000000000)

    def test_malformed_rows_never_become_empty_success(self):
        with self.assertRaises(hub.UpstreamError):
            hub.normalize_sessions({'sessions':[{'unexpected':'value'}]},self.client)
        with self.assertRaises(hub.UpstreamError):
            hub.normalize_jobs([None],self.client)

    def test_only_allowlisted_get_paths_can_be_requested(self):
        for path in ('/api/env/reveal','/api/credentials/test','/api/config/raw','/api/sessions/id/messages','/api/actions/run','http://example.com','/api/cron/jobs?target=external'):
            with self.assertRaises(hub.UpstreamError):
                self.client.request(path)

    def test_token_rotates_once_after_401_and_never_reaches_response(self):
        tokens=[secrets.token_urlsafe(32),secrets.token_urlsafe(32)]
        state={'html':0,'api':0,'headers':[]}
        class Upstream(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path=='/':
                    token=tokens[min(state['html'],1)]
                    state['html']+=1
                    body=f'<script>window.__HERMES_SESSION_TOKEN__ = {json.dumps(token)};</script>'.encode()
                    self.send_response(200)
                else:
                    state['api']+=1
                    state['headers'].append(self.headers.get('X-Hermes-Session-Token'))
                    self.send_response(401 if state['api']==1 else 200)
                    body=b'{"sessions":[]}'
                self.end_headers();self.wfile.write(body)
            def log_message(self,*_):pass
        with ServerContext(Upstream) as upstream, patch.object(hub,'UPSTREAM',upstream.url):
            client=hub.Client()
            self.assertEqual(client.get('/api/sessions?limit=20&offset=0&order=recent'),{'sessions':[]})
            self.assertEqual(state['html'],2)
            self.assertEqual(state['api'],2)
            self.assertEqual(state['headers'],tokens)
            self.assertEqual(client.text(' '.join(tokens)),'[redacted] [redacted]')

    def test_second_401_stops_without_retry_loop(self):
        class Unauthorized(BaseHTTPRequestHandler):
            calls=0
            def do_GET(self):
                type(self).calls+=1
                if self.path=='/':
                    self.send_response(200);self.end_headers()
                    self.wfile.write(('window.__HERMES_SESSION_TOKEN__='+json.dumps(secrets.token_urlsafe(32))).encode())
                else:self.send_error(401)
            def log_message(self,*_):pass
        with ServerContext(Unauthorized) as upstream, patch.object(hub,'UPSTREAM',upstream.url):
            with self.assertRaises(HTTPError):
                hub.Client().get('/api/cron/jobs')
            self.assertEqual(Unauthorized.calls,4)

    def test_redirect_is_not_followed(self):
        class Redirect(BaseHTTPRequestHandler):
            calls=0
            def do_GET(self):
                type(self).calls+=1
                self.send_response(302);self.send_header('Location','/api/credentials/test');self.end_headers()
            def log_message(self,*_):pass
        with ServerContext(Redirect) as upstream, patch.object(hub,'UPSTREAM',upstream.url):
            with self.assertRaises(hub.UpstreamError):
                hub.Client().request('/api/status')
            self.assertEqual(Redirect.calls,1)

    def test_cache_partial_failure_and_recovery(self):
        values={'/api/status':{'gateway_running':True,'gateway_platforms':{}},'/api/sessions?limit=20&offset=0&order=recent':{'sessions':[]},'/api/cron/jobs':[]}
        class FakeClient(hub.Client):
            calls=0
            fail=False
            def get(self,path):
                self.calls+=1
                if self.fail and path=='/api/cron/jobs':raise OSError('PRIVATE')
                return values[path]
        client=FakeClient();app=hub.Hub(client)
        first=app.sample();app.sample();self.assertEqual(client.calls,3)
        client.fail=True;app.cached_at=0;failed=app.sample()
        self.assertTrue(failed['availability']['gateway'])
        self.assertFalse(failed['availability']['jobs'])
        self.assertEqual(failed['jobs'],[])
        self.assertNotIn('PRIVATE',json.dumps(failed))
        client.fail=False;app.cached_at=0;recovered=app.sample()
        self.assertTrue(recovered['availability']['jobs'])
        self.assertGreater(len(recovered['activity']),len(first['activity']))

    def test_http_host_origin_readonly_and_path_boundary(self):
        class FakeHub:
            def sample(self):return {'source':'live','gateway':None}
        with ServerContext(hub.make_handler(FakeHub())) as app:
            with urlopen(app.url+'/api/hub') as response:
                self.assertEqual(json.load(response)['source'],'live')
                self.assertIsNone(response.headers.get('Access-Control-Allow-Origin'))
                self.assertEqual(response.headers['Cache-Control'],'no-store')
            cases=[(Request(app.url+'/api/hub',method='POST'),501),(Request(app.url+'/api/hub',method='DELETE'),501),(Request(app.url+'/api/hub',headers={'Host':'other.example'}),403),(Request(app.url+'/api/hub',headers={'Origin':'http://localhost:9999'}),403),(Request(app.url+'/api/env/reveal'),404),(Request(app.url+'/%2e%2e/server/hub.py'),404),(Request(app.url+'/api/hub?url=other'),404)]
            for request,expected in cases:
                with self.assertRaises(HTTPError) as error:urlopen(request)
                self.assertEqual(error.exception.code,expected)
            with tempfile.TemporaryDirectory() as folder:
                Path(folder,'index.html').write_text('Hermes')
                with patch.object(hub,'ROOT',Path(folder)):
                    with urlopen(app.url+'/') as response:
                        self.assertEqual(response.read(),b'Hermes')
                        self.assertIn("frame-ancestors 'none'",response.headers['Content-Security-Policy'])


if __name__=='__main__':unittest.main()
