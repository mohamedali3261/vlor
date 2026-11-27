"""Run only against isolated local Wrangler/D1 via VLOR_HIDE_TEST_DB."""
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

DB=os.environ.get('VLOR_HIDE_TEST_DB')
ORIGIN=os.environ.get('VLOR_HIDE_TEST_ORIGIN','http://127.0.0.1:8801')

@unittest.skipUnless(DB,'requires isolated local Worker and D1')
class HideOrderTests(unittest.TestCase):
    def req(self,path,method='GET',body=None,token=None,key=None):
        headers={'Origin':ORIGIN}
        if token: headers['Cookie']='__Host-malika_session='+token
        if key: headers['Idempotency-Key']=key
        if body is not None: headers['Content-Type']='application/json';body=json.dumps(body).encode()
        try: r=urllib.request.urlopen(urllib.request.Request(ORIGIN+path,data=body,method=method,headers=headers),timeout=30)
        except urllib.error.HTTPError as e: r=e
        return r.status,json.loads(r.read())

    def test_hide_is_owner_only_and_preserves_orders_tracking_and_stock(self):
        self.assertEqual(self.req('/api/products')[0],200)
        db=sqlite3.connect(DB); owner=secrets.token_hex(32);staff=secrets.token_hex(32);now=int(time.time()*1000)
        for role,token in [('owner',owner),('orders',staff)]:
            name=role+uuid.uuid4().hex
            db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x',role))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),name,now+600000,now))
        product,ml,price=db.execute("SELECT id,json_extract(data,'$.sizes[0].ml'),json_extract(data,'$.sizes[0].price') FROM products WHERE archived=0 LIMIT 1").fetchone()
        db.execute('UPDATE inventory SET quantity=10 WHERE product_id=? AND size=?',(product,ml));db.commit()
        self.assertEqual(self.req('/api/admin/shipping','PUT',{'city':'Cairo','amount':30,'freeThreshold':None},owner)[0],200)
        item={'productId':product,'ml':ml,'qty':2}
        quote=self.req('/api/quote','POST',{'city':'Cairo','items':[item]})[1]
        payload={'customer':{'name':'Test Customer','phone':'01012345678','additionalPhone':'01112345678','city':'Cairo','address':'Test address','note':''},'expectedShipping':quote['shipping'],'expectedDiscount':quote['discount'],'items':[{**item,'expectedPrice':price}]}
        key=str(uuid.uuid4());code,created=self.req('/api/orders','POST',payload,key=key);self.assertEqual(code,201,created)
        id=created['id'];url='/api/admin/orders/'+id
        self.assertEqual(self.req('/api/track','POST',{'token':key})[1]['status'],'new')
        self.assertEqual(self.req(url,'PATCH',{'status':'confirmed'},owner)[0],200)
        self.assertEqual(self.req('/api/track','POST',{'token':key})[1]['status'],'confirmed')
        self.assertEqual(self.req('/api/track','POST',{'token':key})[1]['confirmed'],1)
        self.assertEqual(self.req(url,'PATCH',{'status':'shipped'},owner)[0],200)
        self.assertEqual(self.req('/api/track','POST',{'token':key})[1]['confirmed'],1)
        self.assertEqual(self.req(url,'DELETE')[0],401)
        self.assertEqual(self.req(url,'DELETE',token=staff)[0],403)
        self.assertEqual(self.req(url,'DELETE',token=owner)[0],200)
        self.assertNotIn(id,[o['id'] for o in self.req('/api/admin/orders',token=owner)[1]['orders']])
        self.assertNotIn(id,[o['id'] for o in self.req('/api/admin/orders',token=staff)[1]['orders']])
        self.assertEqual(self.req('/api/track','POST',{'token':key})[1]['status'],'shipped')
        self.assertEqual(self.req('/api/orders','POST',payload,key=key)[1]['id'],id)
        self.assertEqual(self.req(url,'PATCH',{'status':'cancelled'},owner)[0],404)
        self.assertEqual(self.req(url,'DELETE',token=owner)[0],404)
        self.assertEqual(db.execute('SELECT quantity FROM inventory WHERE product_id=? AND size=?',(product,ml)).fetchone()[0],8)
        self.assertEqual(db.execute('SELECT count(*) FROM order_items WHERE order_id=?',(id,)).fetchone()[0],1)
        self.assertEqual(db.execute('SELECT additional_phone FROM order_contacts WHERE order_id=?',(id,)).fetchone()[0],'01112345678')
        self.assertEqual(db.execute("SELECT count(*) FROM audit_log WHERE action='order_hidden' AND target_id=?",(id,)).fetchone()[0],1)
        db.close()
