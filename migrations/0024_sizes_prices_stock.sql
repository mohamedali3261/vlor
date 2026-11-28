-- One-time catalogue update: active products only. Preserves orders, shipping, images,
-- existing image quantities for retained sizes and archived products. Old size stock
-- rows remain for historical cancellation. Removed image-size quantities are archived.
CREATE TABLE IF NOT EXISTS image_stock_removed_size_archive (
  product_id TEXT NOT NULL, image_url TEXT NOT NULL, size INTEGER NOT NULL,
  quantity INTEGER, PRIMARY KEY(product_id,image_url,size)
);
INSERT OR IGNORE INTO image_stock_removed_size_archive(product_id,image_url,size,quantity)
SELECT s.product_id,s.image_url,s.size,s.quantity FROM image_stock s
JOIN products p ON p.id=s.product_id WHERE p.archived=0 AND s.size NOT IN (30,50) AND NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1') AND NOT EXISTS (SELECT 1 FROM products WHERE archived=0 AND NOT json_valid(data));
UPDATE products SET data=json_set(data,'$.price',149,'$.sizes',json('[{"ml":30,"price":149},{"ml":50,"price":179}]'))
WHERE archived=0 AND json_valid(data) AND NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1') AND NOT EXISTS (SELECT 1 FROM products WHERE archived=0 AND NOT json_valid(data));
INSERT INTO inventory(product_id,size,quantity)
SELECT p.id,s.size,5 FROM products p CROSS JOIN (SELECT 30 AS size UNION ALL SELECT 50) s
WHERE p.archived=0 AND json_valid(p.data) AND NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1') AND NOT EXISTS (SELECT 1 FROM products WHERE archived=0 AND NOT json_valid(data))
ON CONFLICT(product_id,size) DO UPDATE SET quantity=excluded.quantity;
INSERT OR IGNORE INTO store_meta(key,value)
SELECT 'catalog_30_50_149_179_stock5_v1','1' WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1') AND NOT EXISTS (SELECT 1 FROM products WHERE archived=0 AND NOT json_valid(data))
AND (EXISTS (SELECT 1 FROM products) OR EXISTS (SELECT 1 FROM store_meta WHERE key='seed_v2' AND value='1'));
