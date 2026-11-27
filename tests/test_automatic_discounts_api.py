"""Run against a disposable local Wrangler/D1: VLOR_DISCOUNT_TEST_DB and VLOR_DISCOUNT_TEST_ORIGIN."""
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

DB = os.environ.get('VLOR_DISCOUNT_TEST_DB')
ORIGIN = os.environ.get('VLOR_DISCOUNT_TEST_ORIGIN', 'http://127.0.0.1:8799')

@unittest.skipUnless(DB, 'requires isolated local Worker and D1')
class AutomaticDiscountTests(unittest.TestCase):
    def request(self, path, method='GET', body=None, token=None, key=None):
        headers = {'Origin':ORIGIN}
        if token: headers['Cookie']='__Host-malika_session='+token
        if key: headers['Idempotency-Key']=key
        if body is not None: headers['Content-Type']='application/json'; body=json.dumps(body).encode()
        try: response=urllib.request.urlopen(urllib.request.Request(ORIGIN+path, data=body, method=method, headers=headers),timeout=30)
        except urllib.error.HTTPError as error: response=error
        return response.status,json.loads(response.read())

    def test_rules_quotes_orders_and_history(self):
        self.assertEqual(self.request('/api/products')[0],200)
        db=sqlite3.connect(DB); token=secrets.token_hex(32); staff=secrets.token_hex(32); now=int(time.time()*1000)
        for role,secret in [('owner',token),('orders',staff)]:
            name=role+uuid.uuid4().hex
            db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x',role))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(secret.encode()).hexdigest(),name,now+600000,now))
        product,raw=db.execute('SELECT id,data FROM products WHERE archived=0 LIMIT 1').fetchone()
        obj=json.loads(raw); obj['sizes'][0]['price']=100; ml=obj['sizes'][0]['ml']
        db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(obj),product))
        db.execute('UPDATE inventory SET quantity=30 WHERE product_id=? AND size=?',(product,ml))
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal,discount,coupon_code) VALUES('old','x','x','Cairo','x','',100,10,'LEGACY')")
        db.commit()
        rate={'city':'Cairo','amount':30,'freeThreshold':250}
        self.assertEqual(self.request('/api/admin/shipping','PUT',rate,token)[0],200)
        a={'id':str(uuid.uuid4()),'kind':'quantity','threshold':3,'percent':10,'enabled':True}
        b={'id':str(uuid.uuid4()),'kind':'amount','threshold':200,'percent':20,'enabled':True}
        off={'id':str(uuid.uuid4()),'kind':'quantity','threshold':1,'percent':90,'enabled':False}
        self.assertEqual(self.request('/api/admin/discount-rules','PUT',a)[0],401)
        self.assertEqual(self.request('/api/admin/discount-rules','PUT',a,staff)[0],403)
        self.assertEqual(self.request('/api/admin/discount-rules','PUT',{**a,'percent':101},token)[0],400)
        for rule in [a,b,off]: self.assertEqual(self.request('/api/admin/discount-rules','PUT',rule,token)[0],200)
        self.assertEqual(len(self.request('/api/discount-rules')[1]),2)
        def quote(qty): return self.request('/api/quote','POST',{'city':'Cairo','items':[{'productId':product,'ml':ml,'qty':qty}]})
        self.assertEqual(quote(1)[1]['discount'],0)
        self.assertEqual(quote(2)[1]['discount'],40)
        quoted=quote(3)[1]; self.assertEqual((quoted['discount'],quoted['shipping'],quoted['total']),(60,30,270))
        self.assertEqual(self.request('/api/quote','POST',{'city':'Cairo','coupon':'LEGACY','items':[{'productId':product,'ml':ml,'qty':1}]})[0],400)
        body={'customer':{'name':'Test User','phone':'01012345678','city':'Cairo','address':'Test address','note':''},'expectedShipping':quoted['shipping'],'expectedDiscount':quoted['discount'],'items':[{'productId':product,'ml':ml,'qty':3,'expectedPrice':100}]}
        self.assertEqual(self.request('/api/admin/discount-rules','PUT',{**b,'percent':25},token)[0],200)
        self.assertEqual(self.request('/api/orders','POST',body,key=str(uuid.uuid4()))[0],409)
        self.assertEqual(db.execute('SELECT quantity FROM inventory WHERE product_id=? AND size=?',(product,ml)).fetchone()[0],30)
        q=quote(3)[1];body['expectedDiscount']=q['discount'];body['expectedShipping']=q['shipping']
        key=str(uuid.uuid4());status,order=self.request('/api/orders','POST',body,key=key); self.assertEqual(status,201,order)
        self.assertEqual(order['discount'],75);self.assertEqual(self.request('/api/orders','POST',body,key=key)[0],200)
        self.assertEqual(db.execute('SELECT count(*) FROM checkout_discount_context').fetchone()[0],0)
        self.assertEqual(db.execute('SELECT quantity FROM inventory WHERE product_id=? AND size=?',(product,ml)).fetchone()[0],27)
        self.assertEqual(self.request('/api/admin/discount-rules/'+b['id'],'DELETE',token=token)[0],200)
        self.assertEqual(quote(3)[1]['discount'],30)
        self.assertEqual(db.execute("SELECT subtotal,discount,coupon_code FROM orders WHERE id='old'").fetchone(),(100,10,'LEGACY'))
        self.assertEqual(db.execute('SELECT discount FROM orders WHERE id=?',(order['id'],)).fetchone()[0],75)
        db.close()
