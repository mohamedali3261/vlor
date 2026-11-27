-- Preserve old coupons and order history; new orders use automatic offers only.
CREATE TABLE IF NOT EXISTS discount_rules (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('quantity','amount')), threshold INTEGER NOT NULL CHECK(threshold > 0), percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100), enabled INTEGER NOT NULL CHECK(enabled IN (0,1)));
CREATE TABLE IF NOT EXISTS checkout_discount_context (order_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity > 0));
DROP TRIGGER IF EXISTS validate_checkout;
DROP TRIGGER IF EXISTS consume_coupon;
CREATE TRIGGER validate_checkout BEFORE INSERT ON orders WHEN NEW.tracking_hash IS NOT NULL BEGIN
  SELECT CASE WHEN NEW.subtotal < 0 OR NEW.discount < 0 OR NEW.shipping < 0 OR NEW.coupon_code IS NOT NULL OR (NOT EXISTS (SELECT 1 FROM checkout_discount_context WHERE order_id=NEW.id) AND (NEW.discount != 0 OR EXISTS (SELECT 1 FROM discount_rules WHERE enabled=1))) THEN RAISE(ABORT, 'discount_changed') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM checkout_discount_context WHERE order_id=NEW.id) AND NEW.discount != CAST(NEW.subtotal * COALESCE((SELECT MAX(percent) FROM discount_rules WHERE enabled=1 AND ((kind='quantity' AND (SELECT quantity FROM checkout_discount_context WHERE order_id=NEW.id)>=threshold) OR (kind='amount' AND NEW.subtotal>=threshold))),0) / 100 AS INTEGER) THEN RAISE(ABORT, 'discount_changed') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shipping_rates r WHERE r.city=NEW.city AND NEW.shipping = CASE WHEN r.free_threshold IS NOT NULL AND NEW.subtotal-NEW.discount>=r.free_threshold THEN 0 ELSE r.amount END) THEN RAISE(ABORT, 'shipping_changed') END;
END;
INSERT OR IGNORE INTO store_meta(key,value) VALUES('automatic_discounts_v1','1');
