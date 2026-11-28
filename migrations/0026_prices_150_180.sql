-- Update only matching active product prices once; preserve owner edits, stock and past orders.
-- Back up image stock because the product-data cleanup trigger runs even for price-only edits.
CREATE TABLE IF NOT EXISTS price_150_180_image_stock_backup (
  product_id TEXT NOT NULL, image_url TEXT NOT NULL, size INTEGER NOT NULL,
  quantity INTEGER, PRIMARY KEY(product_id,image_url,size)
);
INSERT OR IGNORE INTO price_150_180_image_stock_backup(product_id,image_url,size,quantity)
SELECT s.product_id,s.image_url,s.size,s.quantity FROM image_stock s
JOIN products p ON p.id=s.product_id WHERE p.archived=0 AND NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_prices_150_180_v1')
  AND EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1')
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.archived=0 AND CASE WHEN NOT json_valid(p.data) THEN 1 WHEN json_type(p.data,'$.sizes')='array' THEN EXISTS (SELECT 1 FROM json_each(p.data,'$.sizes') s WHERE s.type <> 'object') ELSE 0 END);
UPDATE products SET data = CASE json_extract(data,'$.price')
  WHEN 149 THEN json_set(CASE WHEN json_type(data,'$.sizes')='array' THEN
      json_set(data,'$.sizes',json((SELECT json_group_array(json(CASE json_extract(s.value,'$.price')
        WHEN 149 THEN json_set(s.value,'$.price',150)
        WHEN 179 THEN json_set(s.value,'$.price',180)
        ELSE s.value END)) FROM json_each(data,'$.sizes') s)))
    ELSE data END,'$.price',150)
  WHEN 179 THEN json_set(CASE WHEN json_type(data,'$.sizes')='array' THEN
      json_set(data,'$.sizes',json((SELECT json_group_array(json(CASE json_extract(s.value,'$.price')
        WHEN 149 THEN json_set(s.value,'$.price',150)
        WHEN 179 THEN json_set(s.value,'$.price',180)
        ELSE s.value END)) FROM json_each(data,'$.sizes') s)))
    ELSE data END,'$.price',180)
  ELSE CASE WHEN json_type(data,'$.sizes')='array' THEN
      json_set(data,'$.sizes',json((SELECT json_group_array(json(CASE json_extract(s.value,'$.price')
        WHEN 149 THEN json_set(s.value,'$.price',150)
        WHEN 179 THEN json_set(s.value,'$.price',180)
        ELSE s.value END)) FROM json_each(data,'$.sizes') s)))
    ELSE data END END
WHERE archived=0 AND json_valid(data) AND (json_extract(data,'$.price') IN (149,179) OR
    (json_type(data,'$.sizes')='array' AND EXISTS (SELECT 1 FROM json_each(data,'$.sizes') s WHERE s.type='object' AND json_extract(s.value,'$.price') IN (149,179)))) AND NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_prices_150_180_v1')
  AND EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1')
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.archived=0 AND CASE WHEN NOT json_valid(p.data) THEN 1 WHEN json_type(p.data,'$.sizes')='array' THEN EXISTS (SELECT 1 FROM json_each(p.data,'$.sizes') s WHERE s.type <> 'object') ELSE 0 END);
INSERT OR IGNORE INTO image_stock(product_id,image_url,size,quantity)
SELECT product_id,image_url,size,quantity FROM price_150_180_image_stock_backup WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_prices_150_180_v1')
  AND EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1')
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.archived=0 AND CASE WHEN NOT json_valid(p.data) THEN 1 WHEN json_type(p.data,'$.sizes')='array' THEN EXISTS (SELECT 1 FROM json_each(p.data,'$.sizes') s WHERE s.type <> 'object') ELSE 0 END);
INSERT OR IGNORE INTO store_meta(key,value)
SELECT 'catalog_prices_150_180_v1','1' WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_prices_150_180_v1')
  AND EXISTS (SELECT 1 FROM store_meta WHERE key='catalog_30_50_149_179_stock5_v1')
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.archived=0 AND CASE WHEN NOT json_valid(p.data) THEN 1 WHEN json_type(p.data,'$.sizes')='array' THEN EXISTS (SELECT 1 FROM json_each(p.data,'$.sizes') s WHERE s.type <> 'object') ELSE 0 END);
DROP TABLE IF EXISTS price_150_180_image_stock_backup;
