import json,sqlite3,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class ImageVariantsMigration(unittest.TestCase):
    def test_additive_and_cascade(self):
        db=sqlite3.connect(':memory:');self.addCleanup(db.close);db.execute('PRAGMA foreign_keys=ON')
        for path in sorted((ROOT/'migrations').glob('*.sql')):
            if path.name=='0025_image_variants.sql':break
            db.executescript(path.read_text())
        image='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        db.execute("INSERT INTO images(key,content_type,data_base64,size) VALUES(?, 'image/png', '0123456789abcdef', 12)",(image,))
        data=json.dumps({'sizes':[{'ml':30,'price':149}], 'images':['/api/images/'+image], 'price':149})
        db.execute("INSERT INTO products(id,slug,category_id,data) VALUES('p','p','woody',?)",(data,));db.execute("UPDATE inventory SET quantity=3 WHERE product_id='p'");db.commit()
        migration=(ROOT/'migrations/0025_image_variants.sql').read_text()
        db.executescript(migration);db.executescript(migration)
        self.assertEqual(db.execute("SELECT data FROM products WHERE id='p'").fetchone()[0],data)
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='p'").fetchone()[0],3)
        self.assertEqual(db.execute("SELECT data_base64 FROM images WHERE key=?",(image,)).fetchone()[0],'0123456789abcdef')
        db.execute("INSERT INTO image_variants VALUES(?, 'small-v1','image/png','0123456789abcdef',12)",(image,))
        db.execute("DELETE FROM images WHERE key=?",(image,));self.assertEqual(db.execute('SELECT COUNT(*) FROM image_variants').fetchone()[0],0)
if __name__=='__main__':unittest.main()
