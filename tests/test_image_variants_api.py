"""Run against an isolated local Wrangler/D1 with VLOR_IMAGE_VARIANT_TEST_DB."""
import hashlib,json,os,secrets,sqlite3,time,unittest,urllib.request,urllib.error,uuid
DB=os.environ.get('VLOR_IMAGE_VARIANT_TEST_DB')
ORIGIN=os.environ.get('VLOR_IMAGE_VARIANT_TEST_ORIGIN','http://127.0.0.1:8807')
PNG=bytes.fromhex('89504e470d0a1a0a')
@unittest.skipUnless(DB,'requires an isolated Worker and D1')
class VariantsApiTest(unittest.TestCase):
    def request(self,path,method='GET',data=None,token=None,content_type=None):
        headers={'Origin':ORIGIN}
        if token:headers['Cookie']='__Host-malika_session='+token
        if content_type:headers['Content-Type']=content_type
        try:r=urllib.request.urlopen(urllib.request.Request(ORIGIN+path,data=data,headers=headers,method=method),timeout=30)
        except urllib.error.HTTPError as err:r=err
        return r.status,r.read(),r.headers
    def test_original_variants_fallback_cache_permissions_and_delete(self):
        self.assertEqual(self.request('/api/products')[0],200)
        db=sqlite3.connect(DB);self.addCleanup(db.close)
        token=secrets.token_hex(32);now=int(time.time()*1000);name='owner'+uuid.uuid4().hex
        db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x','owner'))
        db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),name,now+600000,now));db.commit()
        original=PNG+b'original'*100;small=PNG+b'small'*10;large=PNG+b'large'*30
        boundary='variants-test';body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n').encode()+original+(f'\r\n--{boundary}--\r\n').encode()
        status,data,_=self.request('/api/admin/images','POST',body,token,'multipart/form-data; boundary='+boundary);self.assertEqual(status,201,data)
        saved=json.loads(data);url=saved['url'];key=saved['id'];path='/api/admin/images/'+key+'/variants/'
        status,data,h=self.request(url+'?variant=small-v1');self.assertEqual((status,data),(200,original));self.assertEqual(h['Cache-Control'],'no-store')
        self.assertEqual(self.request(path+'small-v1','PUT',small,content_type='image/png')[0],401)
        self.assertEqual(self.request(path+'wrong','PUT',small,token,'image/png')[0],400)
        self.assertEqual(self.request(path+'small-v1','PUT',b'invalid image',token,'image/png')[0],400)
        self.assertEqual(self.request(path+'small-v1','PUT',PNG+bytes(350000),token,'image/png')[0],413)
        self.assertEqual(self.request(path+'small-v1','PUT',small,token,'image/png')[0],201)
        self.assertEqual(self.request(path+'large-v1','PUT',large,token,'image/png')[0],201)
        self.assertEqual(self.request(path+'small-v1','PUT',large,token,'image/png')[0],200)
        status,data,h=self.request(url+'?variant=small-v1');self.assertEqual((status,data),(200,small));self.assertIn('immutable',h['Cache-Control'])
        self.assertEqual(self.request(url+'?variant=large-v1')[1],large)
        self.assertEqual(self.request(url)[1],original)
        self.assertEqual(self.request(url+'?variant=unexpected')[0],400)
        listing=json.loads(self.request('/api/admin/images',token=token)[1]);item=next(x for x in listing['images'] if x['key']==key);self.assertEqual((item['has_small'],item['has_large']),(1,1))
        self.assertEqual(self.request('/api/admin/images/'+key,'DELETE',token=token)[0],200)
        self.assertEqual(self.request(url)[0],404);self.assertEqual(self.request(url+'?variant=small-v1')[0],404)
        self.assertEqual(db.execute('SELECT count(*) FROM image_variants WHERE image_key=?',(key,)).fetchone()[0],0)
        self.assertEqual(self.request(path+'large-v1','PUT',small,token,'image/png')[0],404)
if __name__=='__main__':unittest.main()
