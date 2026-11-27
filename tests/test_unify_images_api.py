"""Run only on disposable local Wrangler/D1 via VLOR_UNIFY_TEST_DB."""
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

DB=os.environ.get('VLOR_UNIFY_TEST_DB')
ORIGIN=os.environ.get('VLOR_UNIFY_TEST_ORIGIN','http://127.0.0.1:8802')
@unittest.skipUnless(DB,'requires isolated local Worker and D1')
class UnifyImagesApiTests(unittest.TestCase):
    def req(self,path,method='GET',body=None,token=None):
        headers={'Origin':ORIGIN}
        if token:headers['Cookie']='__Host-malika_session='+token
        if body is not None:headers['Content-Type']='application/json';body=json.dumps(body).encode()
        try:r=urllib.request.urlopen(urllib.request.Request(ORIGIN+path,method=method,data=body,headers=headers),timeout=30)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read())
    def test_atomic_replace_conflicts_permissions_and_inventory(self):
        self.assertEqual(self.req('/api/products')[0],200)
        db=sqlite3.connect(DB); owner=secrets.token_hex(32);staff=secrets.token_hex(32);now=int(time.time()*1000)
        for role,token in [('owner',owner),('orders',staff)]:
            name=role+uuid.uuid4().hex
            db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x',role))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),name,now+600000,now))
        rows=db.execute('SELECT id,data FROM products WHERE archived=0 ORDER BY id').fetchall();source,target=rows[0][0],rows[1][0]
        data=json.loads(rows[0][1]);data['images']=['https://example.com/a.png','https://example.com/b.png'];data['cutout']='https://example.com/legacy.png'
        db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),source))
        db.execute("INSERT INTO products(id,slug,category_id,data,archived) SELECT 'archive-test','archive-test',category_id,data,1 FROM products WHERE id=?",(source,))
        db.execute('UPDATE inventory SET quantity=7 WHERE product_id=?',(target,));db.commit()
        def snapshot():
            products=self.req('/api/products')[1]
            return {'sourceId':source,'products':[{'id':p['id'],'images':p.get('images',[]),'cutout':p.get('cutout')} for p in products]}
        url='/api/admin/products/unify-images';payload=snapshot();self.assertEqual(self.req(url,'POST',payload)[0],401);self.assertEqual(self.req(url,'POST',payload,staff)[0],403)
        self.assertEqual(self.req(url,'POST',{**payload,'products':payload['products']+[payload['products'][0]]},owner)[0],400)
        # A competing change to images aborts every write.
        changed=json.loads(db.execute('SELECT data FROM products WHERE id=?',(target,)).fetchone()[0]);changed['images']=['https://example.com/concurrent.png']
        db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(changed),target));db.commit()
        before=dict(db.execute('SELECT id,data FROM products'))
        self.assertEqual(self.req(url,'POST',payload,owner)[0],409)
        self.assertEqual(dict(db.execute('SELECT id,data FROM products')),before)
        # Non-image changes after the snapshot are preserved, not overwritten.
        payload=snapshot();changed['price']=12345;db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(changed),target));db.commit()
        inventory=list(db.execute('SELECT product_id,size,quantity FROM inventory ORDER BY product_id,size'))
        before=dict(db.execute('SELECT id,data FROM products'));code,result=self.req(url,'POST',payload,owner);self.assertEqual(code,200,result)
        self.assertEqual(result['count'],len(payload['products'])-1)
        after=dict(db.execute('SELECT id,data FROM products'))
        self.assertEqual(before[source],after[source]);self.assertEqual(before['archive-test'],after['archive-test'])
        for pid,raw in before.items():
            if pid in (source,'archive-test'):continue
            original=json.loads(raw);updated=json.loads(after[pid]);self.assertEqual(updated.pop('images'),data['images']);self.assertNotIn('cutout',updated)
            original.pop('images',None);original.pop('cutout',None);self.assertEqual(updated,original)
        self.assertEqual(inventory,list(db.execute('SELECT product_id,size,quantity FROM inventory ORDER BY product_id,size')))
        self.assertEqual(db.execute("SELECT count(*) FROM audit_log WHERE action='product_images_unified' AND target_id=?",(source,)).fetchone()[0],1)
        # Only old cutout exists: it becomes the primary gallery image for recipients.
        data['images']=[];data['cutout']='https://example.com/fallback.png';db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),source));db.commit()
        self.assertEqual(self.req(url,'POST',snapshot(),owner)[0],200)
        self.assertEqual(json.loads(db.execute('SELECT data FROM products WHERE id=?',(target,)).fetchone()[0])['images'],['https://example.com/fallback.png'])
        data['cutout']='';db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),source));db.commit()
        self.assertEqual(self.req(url,'POST',snapshot(),owner)[0],400)
        # A removed image prevents the transaction, including audit; no other product is touched.
        key=str(uuid.uuid4());data['images']=['/api/images/'+key];data['cutout']=''
        db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(data),source))
        db.execute('INSERT INTO deleted_images(key) VALUES(?)',(key,));db.commit()
        before=dict(db.execute('SELECT id,data FROM products'))
        self.assertEqual(self.req(url,'POST',snapshot(),owner)[0],422)
        self.assertEqual(dict(db.execute('SELECT id,data FROM products')),before)
        db.close()
