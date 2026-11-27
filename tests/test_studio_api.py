"""Run only against an isolated local Worker and disposable D1 database.
Set VLOR_STUDIO_TEST_DB and optionally VLOR_STUDIO_TEST_ORIGIN.
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

DB_PATH = os.environ.get('VLOR_STUDIO_TEST_DB')
ORIGIN = os.environ.get('VLOR_STUDIO_TEST_ORIGIN', 'http://127.0.0.1:8796')

@unittest.skipUnless(DB_PATH, 'requires isolated local Worker and D1')
class StudioApiTests(unittest.TestCase):
    @staticmethod
    def request(path, method='GET', body=None, token=None, key=None):
        headers = {'Origin':ORIGIN}
        if token: headers['Cookie']='__Host-malika_session='+token
        if key: headers['Idempotency-Key']=key
        if body is not None:
            headers['Content-Type']='application/json'
            body=json.dumps(body).encode()
        try: response=urllib.request.urlopen(urllib.request.Request(ORIGIN+path, data=body, method=method, headers=headers),timeout=30)
        except urllib.error.HTTPError as error: response=error
        return response.status, json.loads(response.read())

    def test_direct_save_conflicts_shipping_discounts_and_historical_orders(self):
        self.assertEqual(self.request('/api/products')[0], 200)
        db=sqlite3.connect(DB_PATH)
        token=secrets.token_hex(32); staff_token=secrets.token_hex(32); now=int(time.time()*1000)
        owner='test-owner-'+uuid.uuid4().hex; staff='test-staff-'+uuid.uuid4().hex
        for name,role,key in [(owner,'owner',token),(staff,'orders',staff_token)]:
            db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x',role))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(key.encode()).hexdigest(),name,now+600000,now))
        db.execute("DELETE FROM store_meta WHERE key IN ('storefront_content_v1','storefront_settings_v1')")
        product,ml,price=db.execute("SELECT id,json_extract(data,'$.sizes[0].ml'),json_extract(data,'$.sizes[0].price') FROM products WHERE archived=0 LIMIT 1").fetchone()
        db.execute('UPDATE inventory SET quantity=4 WHERE product_id=? AND size=?',(product,ml));db.commit()
        payload={'version':None,'data':{'studioDeliveryTab':True,'announcements':[{'ar':'رسالة','en':'Message'}], 'strips':{'announcement':{'enabled':True,'speed':44,'direction':'left'}},'theme':{'ink':'#111111','bone':'#eeeeee','accent':'#dddddd','lilac':'#aaaaaa','productImageScale':100,'headingScale':100,'bodyScale':100,'sectionSpacing':100},'sections':{'featured':True}}}
        url='/api/admin/storefront-config/content'
        self.assertEqual(self.request(url,'PUT',payload)[0],401)
        self.assertEqual(self.request(url,'PUT',payload,staff_token)[0],403)
        status,saved=self.request(url,'PUT',payload,token);self.assertEqual(status,200,saved)
        self.assertEqual(self.request('/api/storefront-config')[1]['content']['data']['announcements'][0]['ar'],'رسالة')
        self.assertEqual(self.request(url,'PUT',payload,token)[0],409)
        payload['version']=saved['version'];payload['data']['announcements'][0]['ar']='رسالة جديدة'
        self.assertEqual(self.request(url,'PUT',payload,token)[0],200)
        self.assertEqual(self.request(url,'PUT',payload,token)[0],409)
        invalid={**payload,'data':{**payload['data'],'announcements':'bad'}}
        self.assertEqual(self.request(url,'PUT',invalid,token)[0],400)
        settings={'whatsapp':'201276163222','messenger':'vlor.perfumes','instagram':'@vlor.perfumes','facebook':'https://facebook.com/vlor','youtube':'https://youtube.com/@vlor','tiktok':'https://tiktok.com/@vlor','email':'hello@example.com','phone':'01276163222','freeShippingThreshold':1000,'address':{'en':'Online','ar':'أونلاين'},'hours':{'en':'Daily','ar':'يوميًا'}}
        status,config=self.request('/api/admin/storefront-config/settings','PUT',{'version':None,'data':settings},token)
        self.assertEqual(status,200,config)
        public=self.request('/api/storefront-config')[1]
        self.assertEqual(public['settings']['data']['facebook'],settings['facebook'])
        self.assertEqual(public['content']['data']['announcements'][0]['ar'],'رسالة جديدة')
        self.assertEqual(self.request('/api/admin/storefront-config/settings','PUT',{'version':None,'data':settings},token)[0],409)
        rate={'city':'Cairo','amount':30,'freeThreshold':None}
        rule={'id':str(uuid.uuid4()),'kind':'quantity','threshold':1,'discountAmount':20,'enabled':True}
        self.assertEqual(self.request('/api/admin/shipping','PUT',rate,token)[0],200)
        self.assertEqual(self.request('/api/admin/discount-rules','PUT',rule,token)[0],200)
        item={'productId':product,'ml':ml,'qty':1}
        status,quote=self.request('/api/quote','POST',{'city':'Cairo','items':[item]});self.assertEqual(status,200,quote)
        body={'customer':{'name':'Test User','phone':'01012345678','city':'Cairo','address':'Test address','note':''},'expectedShipping':quote['shipping'],'expectedDiscount':quote['discount'],'items':[{**item,'expectedPrice':price}]}
        status,order=self.request('/api/orders','POST',body,key=str(uuid.uuid4()));self.assertEqual(status,201,order)
        order_before=db.execute('SELECT subtotal,shipping,discount,coupon_code FROM orders WHERE id=?',(order['id'],)).fetchone()
        self.assertEqual(self.request('/api/admin/shipping/Cairo','DELETE',token=staff_token)[0],403)
        self.assertEqual(self.request('/api/admin/shipping/Cairo','DELETE',token=token)[0],200)
        self.assertEqual(self.request('/api/quote','POST',{'city':'Cairo','items':[item]})[0],400)
        self.assertEqual(self.request('/api/admin/discount-rules/'+rule['id'],'DELETE',token=token)[0],200)
        self.assertEqual(self.request('/api/admin/shipping','PUT',rate,token)[0],200)
        self.assertEqual(self.request('/api/quote','POST',{'city':'Cairo','items':[item]})[1]['discount'],0)
        self.assertEqual(db.execute('SELECT subtotal,shipping,discount,coupon_code FROM orders WHERE id=?',(order['id'],)).fetchone(),order_before)
        self.assertEqual(db.execute('SELECT quantity FROM inventory WHERE product_id=? AND size=?',(product,ml)).fetchone()[0],3)
        db.close()
