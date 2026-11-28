"""API tests: run only against a disposable local Wrangler/D1 database."""
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

DB = os.environ.get('VLOR_ORDER_TEST_DB')
ORIGIN = os.environ.get('VLOR_ORDER_TEST_ORIGIN', 'http://127.0.0.1:8787')

@unittest.skipUnless(DB, 'requires isolated local Worker and D1')
class ProductOrderApiTests(unittest.TestCase):
    def req(self, path, method='GET', body=None, token=None):
        headers = {'Origin': ORIGIN}
        if token:
            headers['Cookie'] = '__Host-malika_session=' + token
        if body is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(body).encode()
        try:
            result = urllib.request.urlopen(urllib.request.Request(ORIGIN + path, method=method, data=body, headers=headers), timeout=30)
        except urllib.error.HTTPError as error:
            result = error
        return result.status, json.loads(result.read()), result.headers

    def test_order_permissions_conflicts_and_preserves_data(self):
        status, products, headers = self.req('/api/products')
        self.assertEqual(status, 200)
        self.assertIsNone(headers.get('X-Product-Order-Version'))
        db = sqlite3.connect(DB)
        owner, staff = secrets.token_hex(32), secrets.token_hex(32)
        now = int(time.time() * 1000)
        for role, token in [('owner', owner), ('orders', staff)]:
            name = role + uuid.uuid4().hex
            db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)', (name, name, 'x', 'x', role))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), name, now+600000, now))
        db.execute('UPDATE inventory SET quantity=7')
        db.commit()
        original = list(db.execute('SELECT id,data,archived,updated_at FROM products ORDER BY id'))
        stock = list(db.execute('SELECT * FROM inventory ORDER BY product_id,size'))
        ids = [p['id'] for p in products]
        target = list(reversed(ids))
        path = '/api/admin/product-order'
        self.assertEqual(self.req(path, 'PUT', {'version':None, 'ids':target})[0], 401)
        self.assertEqual(self.req(path, 'PUT', {'version':None, 'ids':target}, staff)[0], 403)
        self.assertEqual(self.req(path, 'PUT', {'version':None, 'ids':target+[target[0]]}, owner)[0], 400)
        self.assertEqual(self.req(path, 'PUT', {'version':None, 'ids':target[:-1]}, owner)[0], 409)
        code, body, _ = self.req(path, 'PUT', {'version':None, 'ids':target}, owner)
        self.assertEqual(code, 200, body)
        version = body['version']
        status, result, headers = self.req('/api/products')
        self.assertEqual([p['id'] for p in result], target)
        self.assertEqual(headers['X-Product-Order-Version'], version)
        self.assertEqual(self.req(path, 'PUT', {'version':None, 'ids':ids}, owner)[0], 409)
        code, body, _ = self.req(path, 'PUT', {'version':version, 'ids':ids}, owner)
        self.assertEqual(code, 200, body)
        self.assertEqual(self.req(path, 'PUT', {'version':version, 'ids':target}, owner)[0], 409)
        self.assertEqual(list(db.execute('SELECT id,data,archived,updated_at FROM products ORDER BY id')), original)
        self.assertEqual(list(db.execute('SELECT * FROM inventory ORDER BY product_id,size')), stock)
        # New products not in the saved order remain visible and appended; stale edits conflict.
        first = products[0]
        new_id = 'order-test-' + uuid.uuid4().hex
        new_data = dict(first, id=new_id, slug=new_id)
        db.execute('INSERT INTO products(id,slug,category_id,data,archived) VALUES(?,?,?,?,0)', (new_id,new_id,first['category'],json.dumps(new_data)))
        db.commit()
        result = self.req('/api/products')[1]
        self.assertEqual([p['id'] for p in result], ids + [new_id])
        self.assertEqual(self.req(path, 'PUT', {'version':body['version'], 'ids':target}, owner)[0], 409)
        self.assertEqual(self.req(path, 'PUT', {'version':body['version'], 'ids':[new_id]+ids}, owner)[0], 200)
        self.assertEqual(self.req('/api/products')[1][0]['id'], new_id)
        db.close()
