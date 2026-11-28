"""Exercise the one-time catalogue rollout on real SQLite migrations and triggers."""
import json, re, sqlite3, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MIGRATION=(ROOT/'migrations/0024_sizes_prices_stock.sql').read_text()
SOURCE=(ROOT/'worker/bootstrap.ts').read_text()
BLOCK=re.search(r'const CATALOG_30_50_STATEMENTS = \[(.*?)\];', SOURCE, re.S).group(1)
BOOTSTRAP=re.findall(r'`(.*?)`',BLOCK,re.S)
MARK='catalog_30_50_149_179_stock5_v1'

def database():
    db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON')
    for path in sorted((ROOT/'migrations').glob('*.sql')):
        if path.name=='0024_sizes_prices_stock.sql':break
        db.executescript(path.read_text())
    return db

def insert(db,pid,archived=0,sizes=None):
    data={'id':pid,'price':350,'compareAt':400,'name':{'en':pid,'ar':'اسم'},'images':['https://example.com/a.png'],'sizes':sizes or [{'ml':30,'price':210},{'ml':50,'price':280},{'ml':100,'price':350}],'custom':'preserve'}
    db.execute('INSERT INTO products(id,slug,category_id,data,archived) VALUES(?,?,?,?,?)',(pid,pid,'woody',json.dumps(data,ensure_ascii=False),archived))
    return data

class SizesPricesRolloutTest(unittest.TestCase):
    def test_rollout_preserves_data_and_can_run_only_once(self):
        db=database();self.addCleanup(db.close)
        original=insert(db,'active'); archived=insert(db,'archive',1);second=insert(db,'second',sizes=[{'ml':100,'price':350}]);img='https://example.com/a.png'
        db.execute("UPDATE inventory SET quantity=17 WHERE product_id='active'")
        db.executemany('INSERT INTO image_stock VALUES(?,?,?,?)',[('active',img,30,0),('active',img,50,3),('active',img,100,7),('archive',img,100,8)])
        db.execute("INSERT INTO shipping_rates VALUES('Cairo',60,500)")
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal) VALUES('old','Name','010','Cairo','Address','',350)")
        db.execute("INSERT INTO order_items VALUES('item','old','active','Name',100,350,1)")
        db.execute("UPDATE orders SET stock_reserved=1 WHERE id='old'")
        db.executescript(MIGRATION)
        for pid,expected in [('active',original),('second',second)]:
            actual=json.loads(db.execute('SELECT data FROM products WHERE id=?',(pid,)).fetchone()[0]);self.assertEqual(actual.pop('price'),149);self.assertEqual(actual.pop('sizes'),[{'ml':30,'price':149},{'ml':50,'price':179}]);expected.pop('price');expected.pop('sizes');self.assertEqual(actual,expected)
            self.assertEqual(db.execute('SELECT size,quantity FROM inventory WHERE product_id=? AND size IN (30,50) ORDER BY size',(pid,)).fetchall(),[(30,5),(50,5)])
        self.assertEqual(json.loads(db.execute("SELECT data FROM products WHERE id='archive'").fetchone()[0]),archived)
        self.assertEqual(db.execute("SELECT size,quantity FROM inventory WHERE product_id='archive' ORDER BY size").fetchall(),[(30,0),(50,0),(100,0)])
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='active' AND size=100").fetchone()[0],17)
        self.assertEqual(db.execute("SELECT size,quantity FROM image_stock WHERE product_id='active' ORDER BY size").fetchall(),[(30,0),(50,3)])
        self.assertEqual(db.execute("SELECT size,quantity FROM image_stock_removed_size_archive WHERE product_id='active'").fetchall(),[(100,7)])
        self.assertEqual(db.execute("SELECT size,quantity FROM image_stock WHERE product_id='archive'").fetchall(),[(100,8)])
        self.assertEqual(db.execute("SELECT amount,free_threshold FROM shipping_rates WHERE city='Cairo'").fetchone(),(60,500))
        self.assertEqual(db.execute("SELECT size,unit_price FROM order_items WHERE id='item'").fetchone(),(100,350))
        db.execute("UPDATE orders SET status='cancelled' WHERE id='old'")
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='active' AND size=100").fetchone()[0],18)
        self.assertEqual(db.execute('SELECT value FROM store_meta WHERE key=?',(MARK,)).fetchone(),('1',))
        db.execute("UPDATE products SET data=json_set(data,'$.price',155,'$.sizes[0].price',155) WHERE id='active'")
        db.execute("UPDATE inventory SET quantity=2 WHERE product_id='active' AND size=30")
        inserted=insert(db,'new-owner-product');db.commit();db.executescript(MIGRATION)
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='active'").fetchone()[0],155)
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='active' AND size=30").fetchone()[0],2)
        self.assertEqual(json.loads(db.execute("SELECT data FROM products WHERE id='new-owner-product'").fetchone()[0]),inserted)

    def test_migrations_before_seed_and_bootstrap_are_equivalent(self):
        db=database();self.addCleanup(db.close);db.executescript(MIGRATION)
        self.assertIsNone(db.execute('SELECT value FROM store_meta WHERE key=?',(MARK,)).fetchone())
        insert(db,'seed');db.commit()
        with db:
            for sql in BOOTSTRAP:db.execute(sql)
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='seed'").fetchone()[0],149)
        self.assertEqual(db.execute("SELECT size,quantity FROM inventory WHERE product_id='seed' AND size IN (30,50) ORDER BY size").fetchall(),[(30,5),(50,5)])
        db.execute("UPDATE inventory SET quantity=1 WHERE product_id='seed' AND size=50");db.commit()
        with db:
            for sql in BOOTSTRAP:db.execute(sql)
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='seed' AND size=50").fetchone()[0],1)

    def test_invalid_product_aborts_rollout_without_partial_changes(self):
        db=database();self.addCleanup(db.close);insert(db,'valid')
        # Simulate damaged legacy JSON that predates the current validation triggers.
        for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='products'").fetchall():db.execute('DROP TRIGGER "'+name+'"')
        db.execute("INSERT INTO products(id,slug,category_id,data) VALUES('bad','bad','woody','not json')")
        db.executescript(MIGRATION)
        self.assertIsNone(db.execute('SELECT value FROM store_meta WHERE key=?',(MARK,)).fetchone())
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='valid'").fetchone()[0],350)

if __name__=='__main__':unittest.main()
