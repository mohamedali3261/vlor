"""Runs only against an isolated local Wrangler/D1 via VLOR_IMAGE_STOCK_DB."""
import hashlib, json, os, secrets, sqlite3, time, unittest, urllib.error, urllib.request, uuid
DB=os.environ.get('VLOR_IMAGE_STOCK_DB')
ORIGIN=os.environ.get('VLOR_IMAGE_STOCK_ORIGIN','http://127.0.0.1:8803')
@unittest.skipUnless(DB,'requires isolated local Worker and D1')
class ImageStockApi(unittest.TestCase):
    def req(self,path,method='GET',body=None,token=None,key=None):
        headers={'Origin':ORIGIN}
        if token: headers['Cookie']='__Host-malika_session='+token
        if key: headers['Idempotency-Key']=key
        if body is not None: headers['Content-Type']='application/json';body=json.dumps(body).encode()
        try: r=urllib.request.urlopen(urllib.request.Request(ORIGIN+path,data=body,method=method,headers=headers),timeout=30)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read())
    def test_manual_stock(self):
        self.assertEqual(self.req('/api/products')[0],200)
        db=sqlite3.connect(DB); now=int(time.time()*1000); owner=secrets.token_hex(32);staff=secrets.token_hex(32)
        for role,token in [('owner',owner),('orders',staff)]:
            name=role+uuid.uuid4().hex
            db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x',role))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),name,now+600000,now))
        rows=db.execute('SELECT id,data FROM products WHERE archived=0 LIMIT 2').fetchall();pid=rows[0][0];other=rows[1][0]; data=json.loads(rows[0][1]); otherdata=json.loads(rows[1][1]);
        data['images']=['https://example.com/a.png','https://example.com/b.png']; data['cutout']=''; data['sizes']=data['sizes'][:2]; sizes=[s['ml'] for s in data['sizes']]; self.assertGreaterEqual(len(sizes),2)
        otherdata['images']=data['images'];db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),pid));db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(otherdata),other)); db.commit()
        url=f'/api/admin/products/{pid}/image-stock'; public=f'/api/products/{pid}/image-stock'; image=data['images'][0]
        payload={'image':image,'sizes':[{'size':sizes[0],'quantity':0,'expected':None},{'size':sizes[1],'quantity':5,'expected':None}]}
        self.assertEqual(self.req(url,'PUT',payload)[0],401); self.assertEqual(self.req(url,'PUT',payload,staff)[0],403);self.assertEqual(self.req(url,token=staff)[0],403)
        code,res=self.req(url,'PUT',payload,owner);self.assertEqual(code,200,res)
        self.assertEqual(self.req(public)[1],[{'image':image,'size':sizes[0],'available':0},{'image':image,'size':sizes[1],'available':1}])
        self.assertEqual(self.req(url,token=owner)[1],[{'image':image,'size':sizes[0],'quantity':0},{'image':image,'size':sizes[1],'quantity':5}])
        self.assertEqual(self.req(url,'PUT',payload,owner)[0],409)
        data['sizes'].append({'ml':999,'price':1}); db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),pid));db.commit()
        self.assertEqual(self.req(url,'PUT',payload,owner)[0],409)
        data['sizes'].pop(); db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),pid));db.commit()
        self.assertEqual(db.execute('SELECT quantity FROM image_stock WHERE product_id=? AND image_url=? AND size=?',(pid,image,sizes[1])).fetchone()[0],5)
        payload['sizes']=[{'size':sizes[0],'quantity':None,'expected':0},{'size':sizes[1],'quantity':0,'expected':5}]
        self.assertEqual(self.req(url,'PUT',payload,owner)[0],200);self.assertEqual(self.req(public)[1],[{'image':image,'size':sizes[1],'available':0}])
        self.assertEqual(self.req(url,'PUT',{'image':'bad','sizes':payload['sizes']},owner)[0],409)
        self.assertEqual(self.req(url,'PUT',{'image':image,'sizes':[{'size':sizes[0],'quantity':-1,'expected':None}]},owner)[0],400)
        db.execute('INSERT INTO image_stock VALUES(?,?,?,?)',(other,image,otherdata['sizes'][0]['ml'],9));db.commit()
        # Placing an order must not change manual image quantities.
        db.execute('UPDATE inventory SET quantity=10 WHERE product_id=? AND size=?',(pid,sizes[1]));db.commit()
        self.assertEqual(self.req('/api/admin/shipping','PUT',{'city':'Cairo','amount':30,'freeThreshold':None},owner)[0],200)
        item={'productId':pid,'ml':sizes[1],'qty':2};quote=self.req('/api/quote','POST',{'city':'Cairo','items':[item]})[1]
        body={'customer':{'name':'Test Customer','phone':'01012345678','city':'Cairo','address':'Test address','note':''},'expectedShipping':quote['shipping'],'expectedDiscount':quote['discount'],'items':[{**item,'expectedPrice':data['sizes'][1]['price']}]}
        before=list(db.execute('SELECT * FROM image_stock ORDER BY product_id,image_url,size')); code,result=self.req('/api/orders','POST',body,key=str(uuid.uuid4()));self.assertEqual(code,201,result);self.assertEqual(before,list(db.execute('SELECT * FROM image_stock ORDER BY product_id,image_url,size')))
        # Reordering retains stock; removal of an image or size cleans only matching rows.
        data['images'].reverse();db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),pid));db.commit();self.assertEqual(before,list(db.execute('SELECT * FROM image_stock ORDER BY product_id,image_url,size')))
        data['sizes']=data['sizes'][:1];db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),pid));db.commit();self.assertEqual(db.execute('SELECT count(*) FROM image_stock WHERE product_id=?',(pid,)).fetchone()[0],1)
        data['images'].remove(image);db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),pid));db.commit();self.assertEqual(db.execute('SELECT count(*) FROM image_stock WHERE product_id=?',(pid,)).fetchone()[0],0);self.assertEqual(db.execute('SELECT quantity FROM image_stock WHERE product_id=?',(other,)).fetchone()[0],9)
        db.close()
