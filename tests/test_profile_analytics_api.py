"""Requires isolated local Worker and D1, via VLOR_PROFILE_ANALYTICS_DB."""
import hashlib,json,os,secrets,sqlite3,time,unittest,urllib.error,urllib.request,uuid
DB=os.environ.get('VLOR_PROFILE_ANALYTICS_DB'); ORIGIN=os.environ.get('VLOR_PROFILE_ANALYTICS_ORIGIN','http://127.0.0.1:8804')
@unittest.skipUnless(DB,'requires isolated local Worker and D1')
class ProfileAnalyticsTest(unittest.TestCase):
    def req(self,path,method='GET',body=None,token=None):
        headers={'Origin':ORIGIN}
        if token:headers['Cookie']='__Host-malika_session='+token
        if body is not None:headers['Content-Type']='application/json';body=json.dumps(body).encode()
        try:r=urllib.request.urlopen(urllib.request.Request(ORIGIN+path,data=body,method=method,headers=headers),timeout=30)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read())
    def test_consent_range_separation_permissions_and_deletion(self):
        self.assertEqual(self.req('/api/products')[0],200);db=sqlite3.connect(DB);owner=secrets.token_hex(32);staff=secrets.token_hex(32);now=int(time.time()*1000)
        for role,token in [('owner',owner),('orders',staff)]:
            name=role+uuid.uuid4().hex;db.execute('INSERT INTO admins VALUES(?,?,?,?,?,0)',(name,name,'x','x',role));db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),name,now+600000,now))
        db.commit();visitor=str(uuid.uuid4());profile=str(uuid.uuid4());other=str(uuid.uuid4());event={'type':'interaction','pagePath':'/shop','action':'add-to-cart','visitorId':visitor}
        self.assertEqual(self.req('/api/analytics/event','POST',event)[0],200)
        self.assertEqual(self.req('/api/analytics/profile','POST',{'token':profile,'name':'Test Profile'})[0],200)
        self.assertEqual(self.req('/api/analytics/profile','POST',{'token':other,'name':'Test Profile'})[0],200)
        reports='/api/admin/analytics/profiles?days=30'
        self.assertEqual(self.req(reports)[0],401);self.assertEqual(self.req(reports,token=staff)[0],403)
        rows=self.req(reports,token=owner)[1]['profiles'];self.assertEqual(len(rows),2);self.assertTrue(all(row['clicks']==0 for row in rows))
        for item in [{**event,'profileToken':profile},{'type':'page_view','pagePath':'/shop','visitorId':visitor,'profileToken':profile},{'type':'product_click','pagePath':'/shop','visitorId':visitor,'profileToken':profile,'productSlug':self.req('/api/products')[1][0]['slug']},{'type':'heartbeat','pagePath':'/shop','visitorId':visitor,'profileToken':profile}]:self.assertEqual(self.req('/api/analytics/event','POST',item)[0],200)
        rows=self.req(reports,token=owner)[1]['profiles'];p=next(r for r in rows if r['clicks']==1);self.assertEqual((p['views'],p['product_clicks']),(1,1));self.assertEqual(sum(r['clicks'] for r in rows),1)
        detail='/api/admin/analytics/profiles/'+p['id']+'?days=30';self.assertEqual(self.req(detail,token=staff)[0],403);result=self.req(detail,token=owner)[1];self.assertEqual(len(result['events']),3);self.assertNotIn(profile,json.dumps(result));self.assertNotIn('address',json.dumps(result))
        # Deleting named analytics does not delete the anonymous aggregate or the other profile, and queued events cannot recreate it.
        self.assertEqual(self.req('/api/analytics/profile/delete','POST',{'token':profile})[0],200)
        self.assertEqual(self.req('/api/analytics/event','POST',{**event,'profileToken':profile})[0],200)
        self.assertEqual(self.req('/api/analytics/profile','POST',{'token':profile,'name':'Test Profile'})[0],410)
        self.assertEqual(self.req(detail,token=owner)[0],404);self.assertEqual(len(self.req(reports,token=owner)[1]['profiles']),1)
        self.assertEqual(db.execute('SELECT SUM(event_count) FROM analytics_actions WHERE action=?',('add-to-cart',)).fetchone()[0],3)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM analytics_profile_events WHERE profile_hash=?',(p['id'],)).fetchone()[0],0)
        for i in range(55):db.execute('INSERT INTO analytics_profiles VALUES(?,?,?)',(f'{i:064x}',f'profile {i}',now+i))
        db.commit();page=self.req(reports,token=owner)[1];self.assertEqual(len(page['profiles']),50);self.assertTrue(page['hasMore']);nextpage=self.req(reports+'&offset=50',token=owner)[1];self.assertEqual(len(nextpage['profiles']),6);self.assertFalse(nextpage['hasMore']);self.assertFalse(set(r['id'] for r in page['profiles']) & set(r['id'] for r in nextpage['profiles']));db.close()
