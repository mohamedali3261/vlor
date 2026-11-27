import json, sqlite3, unittest
from pathlib import Path
class ImageStockMigrationTests(unittest.TestCase):
    def test_cleanup_is_scoped_and_preserves_reordering_and_fallback(self):
        db=sqlite3.connect(':memory:');db.execute('CREATE TABLE products(id TEXT PRIMARY KEY,data TEXT)')
        product={'images':['/a','/b'],'cutout':'/legacy','sizes':[{'ml':50},{'ml':100}]}
        for p in ('p','other'):db.execute('INSERT INTO products VALUES(?,?)',(p,json.dumps(product)))
        migration=Path('migrations/0022_image_stock.sql').read_text();db.executescript(migration);db.executescript(migration)
        db.executemany('INSERT INTO image_stock VALUES(?,?,?,?)',[('p','/a',50,0),('p','/a',100,4),('p','/b',50,1),('other','/a',50,8)])
        def update():db.execute('UPDATE products SET data=? WHERE id=?',(json.dumps(product),'p'))
        product['images'].reverse();update();self.assertEqual(db.execute('SELECT count(*) FROM image_stock').fetchone()[0],4)
        product['sizes']=[{'ml':50}];update();self.assertEqual(db.execute('SELECT count(*) FROM image_stock').fetchone()[0],3)
        product['images']=['/b'];update();self.assertEqual(db.execute('SELECT count(*) FROM image_stock').fetchone()[0],2)
        product['images']=['', '  '];product['cutout']='/b';update();self.assertEqual(db.execute('SELECT count(*) FROM image_stock').fetchone()[0],2)
        product['cutout']='/new';update();self.assertEqual(db.execute('SELECT * FROM image_stock').fetchall(),[('other','/a',50,8)])
