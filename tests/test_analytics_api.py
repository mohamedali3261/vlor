"""Opt-in integration test using an isolated local Wrangler/D1 database, never production.
Set VLOR_ANALYTICS_TEST_DB to the local SQLite file and VLOR_ANALYTICS_TEST_ORIGIN.
"""
import hashlib
import json
import os
import secrets
import sqlite3
import time
import unittest
import urllib.error
import urllib.request
import uuid

DB_PATH = os.environ.get('VLOR_ANALYTICS_TEST_DB')
ORIGIN = os.environ.get('VLOR_ANALYTICS_TEST_ORIGIN', 'http://127.0.0.1:8795')

@unittest.skipUnless(DB_PATH, 'requires an isolated local Worker and D1 database')
class AnalyticsApiTests(unittest.TestCase):
    @staticmethod
    def request(path, body=None, token=None):
        headers = {'Origin': ORIGIN}
        if token:
            headers['Cookie'] = '__Host-malika_session=' + token
        if body is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(body).encode()
        try:
            response = urllib.request.urlopen(urllib.request.Request(ORIGIN + path, data=body, headers=headers), timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        return response.status, json.loads(response.read())

    def test_events_online_admin_and_privacy(self):
        self.assertEqual(self.request('/api/products')[0], 200)
        db = sqlite3.connect(DB_PATH)
        # This opt-in test requires a disposable local database.
        db.execute('DELETE FROM analytics_daily')
        db.execute('DELETE FROM analytics_actions')
        db.execute('DELETE FROM analytics_presence')
        token = secrets.token_hex(32)
        now = int(time.time() * 1000)
        admin = 'analytics-test-' + uuid.uuid4().hex
        db.execute('INSERT INTO admins(id,username,salt,password_hash,role,must_change_password) VALUES(?,?,?,?,?,0)', (admin,admin,'x','x','owner'))
        db.execute('INSERT INTO sessions(token_hash,admin_id,expires_at,last_seen) VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(),admin,now+600000,now))
        db.commit()
        self.assertEqual(self.request('/api/admin/analytics')[0], 401)
        a, b = str(uuid.uuid4()), str(uuid.uuid4())
        def event(kind, visitor, path='/', **extra):
            return self.request('/api/analytics/event', {'type':kind,'visitorId':visitor,'pagePath':path,**extra})
        for visitor in (a,b):
            self.assertEqual(event('page_view',visitor)[0], 200)
            self.assertEqual(event('heartbeat',visitor)[0], 200)
        self.assertEqual(event('page_view',a,'/shop')[0], 200)
        self.assertEqual(event('interaction',a,'/shop',action='add-to-cart')[0], 200)
        self.assertEqual(event('interaction',a,'/shop',action='add-to-cart')[0], 200)
        self.assertEqual(event('interaction',b,'/shop',action='checkout')[0], 200)
        self.assertEqual(event('interaction',a,'/shop',action='private customer text')[0], 400)
        self.assertTrue(event('heartbeat',a,'/studio')[1]['ignored'])
        status, result = self.request('/api/admin/analytics?days=400', token=token)
        self.assertEqual(status, 200)
        self.assertEqual(result['activeVisitors'], 2)
        self.assertEqual(result['retainedTotals'], {'visitors':2,'pageViews':3})
        self.assertEqual(result['summary']['visitors'], 2)
        action = next(x for x in result['actions'] if x['action']=='add-to-cart')
        self.assertEqual((action['path'],action['clicks'],action['visitors']), ('/shop',2,1))
        # Old heartbeats are not online; no raw browser IDs were persisted.
        db.execute('UPDATE analytics_presence SET last_seen=? WHERE visitor_hash=?', (now-301000,hashlib.sha256(('analytics-v1:'+a).encode()).hexdigest()))
        db.commit()
        self.assertEqual(self.request('/api/admin/analytics', token=token)[1]['activeVisitors'], 1)
        self.assertIsNone(db.execute('SELECT visitor_hash FROM analytics_actions WHERE visitor_hash=?', (a,)).fetchone())
        db.close()
