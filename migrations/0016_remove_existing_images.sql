-- One-time owner-requested removal of all existing product image links and
-- uploaded images. Preserve product metadata, inventory and order records.
-- The marker makes this safe to rerun after the owner uploads new images.
UPDATE products
SET data = json_remove(json_set(data, '$.images', json('[]')), '$.cutout')
WHERE json_valid(data)
  AND NOT EXISTS (SELECT 1 FROM store_meta WHERE key='remove_old_images_v1');

INSERT OR IGNORE INTO deleted_images(key)
SELECT key FROM images
WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='remove_old_images_v1');

DELETE FROM images
WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='remove_old_images_v1');

INSERT OR IGNORE INTO store_meta(key, value) VALUES ('remove_old_images_v1', '1');
