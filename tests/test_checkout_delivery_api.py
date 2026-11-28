"""Run only on an isolated local Worker/D1 via VLOR_CHECKOUT_TEST_DB."""
import hashlib,json,os,secrets,sqlite3,time,unittest,urllib.error,urllib.request,uuid
DB=os.environ.get('VLOR_CHECKOUT_TEST_DB'); ORIGIN=os.environ.get('VLOR_CHECKOUT_TEST_ORIGIN','http://127.0.0.1:8805')
@unittest.skipUnless(DB,'requires isolated local Worker and D1')
class CheckoutDeliveryApiTest(unittest.TestCase):
    def req(self,path,method='GET',body=None,token=None,key=None):
        headers={'Origin':ORIGIN}
        if token:headers['Cookie']='__Host-malika_session='+token
        if key:headers['Idempotency-Key']=key
        if body is not None:headers['Content-Type']='application/json';body=json.dumps(body).encode()
        try:r=urllib.request.urlopen(urllib.request.Request(ORIGIN+path,data=body,method=method,headers=headers),timeout=30)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read())
    def test_placed_order_visible_in_studio_retries_and_insufficient_stock(self):
        self.assertEqual(self.req('/api/products')[0],200);db=sqlite3.connect(DB);token=secrets.token_hex(32);now=int(time.time()*1000);name='owner'+uuid.uuid4().hex
        db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x','owner'));db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),name,now+600000,now))
        pid,ml,price=db.execute("SELECT id,json_extract(data,'$.sizes[0].ml'),json_extract(data,'$.sizes[0].price') FROM products WHERE archived=0 LIMIT 1").fetchone();db.execute('UPDATE inventory SET quantity=4 WHERE product_id=? AND size=?',(pid,ml));db.commit()
        self.assertEqual(self.req('/api/admin/shipping','PUT',{'city':'Cairo','amount':30,'freeThreshold':None},token)[0],200)
        item={'productId':pid,'ml':ml,'qty':1};quote=self.req('/api/quote','POST',{'city':'Cairo','items':[item]})[1]
        order={'customer':{'name':'Test Customer','phone':'01012345678','additionalPhone':'','city':'Cairo','address':'Test address','note':''},'expectedShipping':quote['shipping'],'expectedDiscount':quote['discount'],'items':[{**item,'expectedPrice':price}]};key=str(uuid.uuid4())
        code,created=self.req('/api/orders','POST',order,key=key);self.assertEqual(code,201,created)
        code,retry=self.req('/api/orders','POST',order,key=key);self.assertEqual(code,200,retry);self.assertEqual(retry['id'],created['id']);self.assertEqual(retry['trackingToken'],key)
        self.assertEqual(self.req('/api/track','POST',{'token':key})[1]['status'],'new')
        studio=self.req('/api/admin/orders?page=1',token=token)[1];self.assertIn(created['id'],[r['id'] for r in studio['orders']]);self.assertEqual(sum(i['quantity'] for i in studio['items'] if i['order_id']==created['id']),1)
        self.assertEqual(db.execute('SELECT quantity FROM inventory WHERE product_id=? AND size=?',(pid,ml)).fetchone()[0],3)
        item['qty']=4;quote=self.req('/api/quote','POST',{'city':'Cairo','items':[item]})[1];order['expectedShipping']=quote['shipping'];order['expectedDiscount']=quote['discount'];order['items']=[{**item,'expectedPrice':price}]
        code,rejected=self.req('/api/orders','POST',order,key=str(uuid.uuid4()));self.assertEqual(code,409,rejected);self.assertEqual(rejected['code'],'OUT_OF_STOCK');self.assertEqual(db.execute('SELECT quantity FROM inventory WHERE product_id=? AND size=?',(pid,ml)).fetchone()[0],3)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM orders WHERE customer_name=?',('Test Customer',)).fetchone()[0],1);db.close()
