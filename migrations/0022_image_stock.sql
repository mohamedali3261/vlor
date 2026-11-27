-- Manual display-only stock per product image and size; order stock is unchanged.
CREATE TABLE IF NOT EXISTS image_stock (product_id TEXT NOT NULL REFERENCES products(id), image_url TEXT NOT NULL, size INTEGER NOT NULL CHECK(size > 0), quantity INTEGER CHECK(quantity IS NULL OR quantity BETWEEN 0 AND 1000000), PRIMARY KEY(product_id,image_url,size));
CREATE TRIGGER IF NOT EXISTS image_stock_cleanup AFTER UPDATE OF data ON products BEGIN
  DELETE FROM image_stock WHERE product_id=NEW.id AND (
    (NOT EXISTS (SELECT 1 FROM json_each(NEW.data,'$.images') j WHERE j.value=image_url)
      AND NOT (NOT EXISTS (SELECT 1 FROM json_each(NEW.data,'$.images') valid WHERE valid.type='text' AND length(trim(valid.value))>0) AND COALESCE(json_extract(NEW.data,'$.cutout'),'')=image_url))
    OR NOT EXISTS (SELECT 1 FROM json_each(NEW.data,'$.sizes') s WHERE json_extract(s.value,'$.ml')=image_stock.size)
  );
END;
