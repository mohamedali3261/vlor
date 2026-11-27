import { INITIAL_ADMIN, SEED_IMAGES, SEED_PRODUCTS, SEED_SHIPPING_RATES } from './seedData';
import NEW_PRODUCTS from './newProducts.json';

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS store_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO categories VALUES ('fresh','Fresh','منعش'),('floral','Floral','زهري'),('woody','Woody','خشبي'),('oriental','Oriental','شرقي')`,
  `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, category_id TEXT NOT NULL REFERENCES categories(id), data TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','orders')), must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1)))`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, note TEXT NOT NULL, subtotal INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, idempotency_key TEXT, request_hash TEXT, stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK(stock_reserved IN (0, 1)), shipping INTEGER NOT NULL DEFAULT 0, discount INTEGER NOT NULL DEFAULT 0, coupon_code TEXT, tracking_hash TEXT)`,
  `CREATE TABLE IF NOT EXISTS hidden_studio_orders (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE, hidden_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS order_contacts (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE, additional_phone TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, size INTEGER NOT NULL, unit_price INTEGER NOT NULL, quantity INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS order_tracking_hash ON orders(tracking_hash) WHERE tracking_hash IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, action TEXT NOT NULL, target_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS audit_log_created ON audit_log(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS audit_log_order_confirmation ON audit_log(target_id,action)`,
  `CREATE TABLE IF NOT EXISTS inventory (product_id TEXT NOT NULL REFERENCES products(id), size INTEGER NOT NULL CHECK(size > 0), quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), PRIMARY KEY (product_id, size))`,
  `CREATE TABLE IF NOT EXISTS shipping_rates (city TEXT PRIMARY KEY, amount INTEGER NOT NULL CHECK(amount >= 0), free_threshold INTEGER CHECK(free_threshold IS NULL OR free_threshold >= 0))`,
  `CREATE TABLE IF NOT EXISTS checkout_discount_context (order_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity > 0))`,
  `CREATE TABLE IF NOT EXISTS discount_rules (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('quantity','amount')), threshold INTEGER NOT NULL CHECK(threshold > 0), percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100), enabled INTEGER NOT NULL CHECK(enabled IN (0,1)))`,
  `CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100), max_uses INTEGER NOT NULL CHECK(max_uses > 0), uses INTEGER NOT NULL DEFAULT 0 CHECK(uses >= 0), expires_at TEXT, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)))`,
  `CREATE TABLE IF NOT EXISTS analytics_daily (day TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('page_view','product_click')), page_path TEXT NOT NULL, target_id TEXT NOT NULL DEFAULT '', visitor_hash TEXT NOT NULL, event_count INTEGER NOT NULL DEFAULT 1 CHECK(event_count >= 1), PRIMARY KEY(day,event_type,page_path,target_id,visitor_hash), CHECK((event_type='page_view' AND target_id='') OR (event_type='product_click' AND target_id<>'')))`,
  `CREATE INDEX IF NOT EXISTS analytics_daily_pages ON analytics_daily(event_type,day,page_path)`,
  `CREATE TABLE IF NOT EXISTS analytics_actions (day TEXT NOT NULL, page_path TEXT NOT NULL, action TEXT NOT NULL, visitor_hash TEXT NOT NULL, event_count INTEGER NOT NULL DEFAULT 1 CHECK(event_count >= 1), PRIMARY KEY(day,page_path,action,visitor_hash))`,
  `CREATE INDEX IF NOT EXISTS analytics_actions_period ON analytics_actions(day,page_path,action)`,
  `CREATE TABLE IF NOT EXISTS analytics_presence (visitor_hash TEXT PRIMARY KEY, last_seen INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS analytics_presence_seen ON analytics_presence(last_seen)`,
  `CREATE INDEX IF NOT EXISTS analytics_daily_products ON analytics_daily(event_type,day,target_id)`,
  `CREATE TABLE IF NOT EXISTS analytics_profiles (profile_hash TEXT PRIMARY KEY, name TEXT NOT NULL, last_seen INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS analytics_profile_revocations (profile_hash TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS analytics_profile_events (profile_hash TEXT NOT NULL REFERENCES analytics_profiles(profile_hash) ON DELETE CASCADE, day TEXT NOT NULL, kind TEXT NOT NULL, page_path TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', event_count INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(profile_hash,day,kind,page_path,target))`,
  `CREATE INDEX IF NOT EXISTS analytics_profile_events_day ON analytics_profile_events(day)`,
  `CREATE TABLE IF NOT EXISTS deleted_images (key TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS images (key TEXT PRIMARY KEY, content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg', 'image/png', 'image/webp')), data_base64 TEXT NOT NULL CHECK(length(data_base64) BETWEEN 16 AND 1333336), size INTEGER NOT NULL CHECK(size BETWEEN 12 AND 1000000), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
];

const ALTER_COLUMNS = [
  `ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN idempotency_key TEXT`,
  `ALTER TABLE orders ADD COLUMN request_hash TEXT`,
  `ALTER TABLE orders ADD COLUMN stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK(stock_reserved IN (0, 1))`,
  `ALTER TABLE orders ADD COLUMN shipping INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN coupon_code TEXT`,
  `ALTER TABLE orders ADD COLUMN tracking_hash TEXT`,
  `ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','orders'))`,
  `ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1))`,
];

const TRIGGER_STATEMENTS = [
  `DROP TRIGGER IF EXISTS product_inventory_insert`,
  `DROP TRIGGER IF EXISTS product_inventory_update`,
  `CREATE TRIGGER product_inventory_insert AFTER INSERT ON products BEGIN
    INSERT INTO inventory(product_id, size)
    SELECT NEW.id, CAST(json_extract(value, '$.ml') AS INTEGER) FROM json_each(NEW.data, '$.sizes') WHERE 1
    ON CONFLICT(product_id, size) DO NOTHING;
  END`,
  `CREATE TRIGGER product_inventory_update AFTER UPDATE OF data ON products BEGIN
    INSERT INTO inventory(product_id, size)
    SELECT NEW.id, CAST(json_extract(value, '$.ml') AS INTEGER) FROM json_each(NEW.data, '$.sizes') WHERE 1
    ON CONFLICT(product_id, size) DO NOTHING;
  END`,
  `CREATE TRIGGER IF NOT EXISTS validate_and_reserve_order_item BEFORE INSERT ON order_items
  WHEN (SELECT stock_reserved FROM orders WHERE id=NEW.order_id) = 1
  BEGIN
    SELECT CASE WHEN NEW.quantity < 1 OR NOT EXISTS (
      SELECT 1 FROM products p, json_each(p.data, '$.sizes') s
      WHERE p.id=NEW.product_id AND p.archived=0
        AND json_extract(s.value, '$.ml')=NEW.size
        AND json_extract(s.value, '$.price')=NEW.unit_price
    ) THEN RAISE(ABORT, 'product_changed') END;
    SELECT CASE WHEN NOT EXISTS (
      SELECT 1 FROM inventory WHERE product_id=NEW.product_id AND size=NEW.size AND quantity>=NEW.quantity
    ) THEN RAISE(ABORT, 'insufficient_stock') END;
    UPDATE inventory SET quantity=quantity-NEW.quantity WHERE product_id=NEW.product_id AND size=NEW.size;
  END`,
  `CREATE TRIGGER IF NOT EXISTS cancelled_orders_are_final BEFORE UPDATE OF status ON orders
  WHEN OLD.status='cancelled' AND NEW.status != 'cancelled'
  BEGIN SELECT RAISE(ABORT, 'cancelled_order_is_final'); END`,
  `CREATE TRIGGER IF NOT EXISTS restore_cancelled_order_stock AFTER UPDATE OF status ON orders
  WHEN OLD.status != 'cancelled' AND NEW.status='cancelled' AND OLD.stock_reserved=1
  BEGIN
    UPDATE inventory SET quantity=quantity + COALESCE((
      SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND product_id=inventory.product_id AND size=inventory.size
    ),0)
    WHERE EXISTS (SELECT 1 FROM order_items WHERE order_id=NEW.id AND product_id=inventory.product_id AND size=inventory.size);
  END`,
  `CREATE TRIGGER IF NOT EXISTS prevent_deleted_images_insert BEFORE INSERT ON products BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM deleted_images d, json_each(NEW.data, '$.images') j WHERE instr(j.value, '/api/images/' || d.key)>0) OR EXISTS (SELECT 1 FROM deleted_images d WHERE instr(COALESCE(json_extract(NEW.data,'$.cutout'),''),'/api/images/' || d.key)>0) THEN RAISE(ABORT, 'deleted_image') END;
  END`,
  `CREATE TRIGGER IF NOT EXISTS prevent_deleted_images_update BEFORE UPDATE OF data ON products BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM deleted_images d, json_each(NEW.data, '$.images') j WHERE instr(j.value, '/api/images/' || d.key)>0) OR EXISTS (SELECT 1 FROM deleted_images d WHERE instr(COALESCE(json_extract(NEW.data,'$.cutout'),''),'/api/images/' || d.key)>0) THEN RAISE(ABORT, 'deleted_image') END;
  END`,
];

let readyDb: D1Database | null = null;
let pendingInit: Promise<void> | null = null;

async function applyVlorBrandMigration(db: D1Database): Promise<void> {
  const rebranded = await db
    .prepare("SELECT value FROM store_meta WHERE key='rebrand_vlor_v2'")
    .first<{ value: string }>();
  if (rebranded?.value === '1') return;

  const rows = await db
    .prepare('SELECT id, slug, data FROM products')
    .all<{ id: string; slug: string; data: string }>();

  const updates: D1PreparedStatement[] = [];
  for (const row of rows.results ?? []) {
    try {
      const parsed = JSON.parse(row.data);
      let changed = false;

      if (row.id === 'malika-noir' || row.slug === 'malika-noir') {
        if (parsed.slug === 'malika-noir') {
          parsed.slug = 'vlor-noir';
          changed = true;
        }
      }

      for (const field of ['name', 'tagline', 'description', 'story'] as const) {
        if (parsed[field]?.en && /malika/i.test(parsed[field].en)) {
          parsed[field].en = parsed[field].en.replace(/MALIKA/g, 'VLOR').replace(/Malika/g, 'VLOR').replace(/malika/gi, 'VLOR');
          changed = true;
        }
        if (parsed[field]?.ar && parsed[field].ar.includes('مليكة')) {
          parsed[field].ar = parsed[field].ar.replace(/مليكة/g, 'VLOR');
          changed = true;
        }
      }

      const nextSlug = row.slug === 'malika-noir' ? 'vlor-noir' : row.slug;
      if (changed || nextSlug !== row.slug) {
        updates.push(
          db
            .prepare('UPDATE products SET slug = ?, data = ? WHERE id = ?')
            .bind(nextSlug, JSON.stringify(parsed), row.id)
        );
      }
    } catch {
      // Keep invalid/custom row untouched if JSON parsing fails.
    }
  }

  updates.push(
    db.prepare("INSERT OR REPLACE INTO store_meta(key, value) VALUES ('rebrand_vlor_v2', '1')")
  );
  await db.batch(updates);
}

// Some installations deploy the Worker without running D1 migrations. Add the
// requested scents once there as well, without changing owner-managed products,
// including archived items. D1 batch is atomic; the marker prevents later
// requests from re-adding a product the owner has deliberately removed.
async function ensureRequestedScents(db: D1Database): Promise<void> {
  const marker = await db.prepare("SELECT value FROM store_meta WHERE key='requested_scents_v1'").first<{ value: string }>();
  if (marker?.value === '1') return;

  const inserts = NEW_PRODUCTS.map((p) => db.prepare(`
    INSERT OR IGNORE INTO products (id, slug, category_id, data)
    SELECT ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='requested_scents_v1' AND value='1')
      AND NOT EXISTS (
        SELECT 1 FROM products existing
        WHERE existing.id = ? OR existing.slug = ?
          OR CASE WHEN json_valid(existing.data) THEN
            lower(json_extract(existing.data, '$.name.en')) = lower(?)
            OR json_extract(existing.data, '$.name.ar') = ?
          ELSE 0 END
      )
  `).bind(p.id, p.slug, p.category, JSON.stringify(p), p.id, p.slug, p.name.en, p.name.ar));

  await db.batch([
    ...inserts,
    db.prepare("INSERT INTO store_meta(key, value) VALUES ('requested_scents_v1', '1') ON CONFLICT(key) DO UPDATE SET value=excluded.value"),
  ]);
}

// Some deployments skip D1 migrations; apply the same one-time removal atomically.
async function removeOldImages(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`UPDATE products SET data = json_remove(json_set(data, '$.images', json('[]')), '$.cutout') WHERE json_valid(data) AND NOT EXISTS (SELECT 1 FROM store_meta WHERE key='remove_old_images_v1')`),
    db.prepare(`INSERT OR IGNORE INTO deleted_images(key) SELECT key FROM images WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='remove_old_images_v1')`),
    db.prepare(`DELETE FROM images WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='remove_old_images_v1')`),
    db.prepare(`INSERT OR IGNORE INTO store_meta(key, value) VALUES ('remove_old_images_v1', '1')`),
  ]);
}

// Upgrade initialized installations without touching historic orders or coupon records.
const DISCOUNT_TRIGGER = `CREATE TRIGGER validate_checkout BEFORE INSERT ON orders WHEN NEW.tracking_hash IS NOT NULL BEGIN
  SELECT CASE WHEN NEW.subtotal < 0 OR NEW.discount < 0 OR NEW.shipping < 0 OR NEW.coupon_code IS NOT NULL OR (NOT EXISTS (SELECT 1 FROM checkout_discount_context WHERE order_id=NEW.id) AND (NEW.discount != 0 OR EXISTS (SELECT 1 FROM discount_rules WHERE enabled=1))) THEN RAISE(ABORT, 'discount_changed') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM checkout_discount_context WHERE order_id=NEW.id) AND NEW.discount != CAST(NEW.subtotal * COALESCE((SELECT MAX(percent) FROM discount_rules WHERE enabled=1 AND ((kind='quantity' AND (SELECT quantity FROM checkout_discount_context WHERE order_id=NEW.id)>=threshold) OR (kind='amount' AND NEW.subtotal>=threshold))),0) / 100 AS INTEGER) THEN RAISE(ABORT, 'discount_changed') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shipping_rates r WHERE r.city=NEW.city AND NEW.shipping = CASE WHEN r.free_threshold IS NOT NULL AND NEW.subtotal-NEW.discount>=r.free_threshold THEN 0 ELSE r.amount END) THEN RAISE(ABORT, 'shipping_changed') END;
END`;
async function ensureDiscountRules(db: D1Database): Promise<void> {
  await db.prepare(DDL_STATEMENTS.find(sql => sql.includes('CREATE TABLE IF NOT EXISTS discount_rules'))!).run();
  await db.prepare(DDL_STATEMENTS.find(sql => sql.includes('CREATE TABLE IF NOT EXISTS checkout_discount_context'))!).run();
  const marker = await db.prepare("SELECT value FROM store_meta WHERE key='automatic_discounts_v1'").first();
  if (!marker) await db.batch([
    db.prepare('DROP TRIGGER IF EXISTS validate_checkout'),
    db.prepare('DROP TRIGGER IF EXISTS consume_coupon'),
    db.prepare(DISCOUNT_TRIGGER),
    db.prepare("INSERT OR IGNORE INTO store_meta(key,value) VALUES('automatic_discounts_v1','1')"),
  ]);
}

// Percentage offers cannot be converted to pounds without changing their meaning.
// Keep them as disabled drafts until the owner supplies a fixed amount.
const FIXED_RULES_TABLE = `CREATE TABLE IF NOT EXISTS discount_amount_rules (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('quantity','amount')), threshold INTEGER NOT NULL CHECK(threshold > 0), discount_amount INTEGER CHECK(discount_amount IS NULL OR discount_amount BETWEEN 1 AND 10000000), legacy_percent INTEGER CHECK(legacy_percent IS NULL OR legacy_percent BETWEEN 1 AND 100), enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), CHECK(enabled=0 OR discount_amount IS NOT NULL))`;
const FIXED_CONTEXT_TABLE = `CREATE TABLE IF NOT EXISTS checkout_amount_context (order_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity > 0))`;
// Separate contexts allow an old worker to finish orders during the migration/deploy window.
const FIXED_DISCOUNT_TRIGGER = `CREATE TRIGGER validate_checkout BEFORE INSERT ON orders WHEN NEW.tracking_hash IS NOT NULL BEGIN
  SELECT CASE WHEN NEW.subtotal < 0 OR NEW.discount < 0 OR NEW.shipping < 0 OR NEW.coupon_code IS NOT NULL OR (NOT EXISTS (SELECT 1 FROM checkout_amount_context WHERE order_id=NEW.id) AND NOT EXISTS (SELECT 1 FROM checkout_discount_context WHERE order_id=NEW.id) AND (NEW.discount != 0 OR EXISTS (SELECT 1 FROM discount_amount_rules WHERE enabled=1) OR EXISTS (SELECT 1 FROM discount_rules WHERE enabled=1))) THEN RAISE(ABORT, 'discount_changed') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM checkout_amount_context WHERE order_id=NEW.id) AND NEW.discount != MIN(NEW.subtotal, COALESCE((SELECT MAX(discount_amount) FROM discount_amount_rules WHERE enabled=1 AND ((kind='quantity' AND (SELECT quantity FROM checkout_amount_context WHERE order_id=NEW.id)>=threshold) OR (kind='amount' AND NEW.subtotal>=threshold))),0)) THEN RAISE(ABORT, 'discount_changed') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM checkout_amount_context WHERE order_id=NEW.id) AND EXISTS (SELECT 1 FROM checkout_discount_context WHERE order_id=NEW.id) AND NEW.discount != CAST(NEW.subtotal * COALESCE((SELECT MAX(percent) FROM discount_rules WHERE enabled=1 AND ((kind='quantity' AND (SELECT quantity FROM checkout_discount_context WHERE order_id=NEW.id)>=threshold) OR (kind='amount' AND NEW.subtotal>=threshold))),0) / 100 AS INTEGER) THEN RAISE(ABORT, 'discount_changed') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shipping_rates r WHERE r.city=NEW.city AND NEW.shipping = CASE WHEN r.free_threshold IS NOT NULL AND NEW.subtotal-NEW.discount>=r.free_threshold THEN 0 ELSE r.amount END) THEN RAISE(ABORT, 'shipping_changed') END;
END`;
async function ensureFixedDiscountRules(db: D1Database): Promise<void> {
  await db.prepare(FIXED_RULES_TABLE).run();
  await db.prepare(FIXED_CONTEXT_TABLE).run();
  const marker = await db.prepare("SELECT value FROM store_meta WHERE key='fixed_discounts_v1'").first();
  if (!marker) await db.batch([
    db.prepare("INSERT OR IGNORE INTO discount_amount_rules(id,kind,threshold,discount_amount,legacy_percent,enabled) SELECT id,kind,threshold,NULL,percent,0 FROM discount_rules WHERE NOT EXISTS (SELECT 1 FROM store_meta WHERE key='fixed_discounts_v1')"),
    db.prepare('DROP TRIGGER IF EXISTS validate_checkout'),
    db.prepare(FIXED_DISCOUNT_TRIGGER),
    db.prepare("INSERT OR IGNORE INTO store_meta(key,value) VALUES('fixed_discounts_v1','1')"),
  ]);
}

// Per-image values are intentionally separate from order inventory: they are manual display data.
const IMAGE_STOCK_TABLE = `CREATE TABLE IF NOT EXISTS image_stock (product_id TEXT NOT NULL REFERENCES products(id), image_url TEXT NOT NULL, size INTEGER NOT NULL CHECK(size > 0), quantity INTEGER CHECK(quantity IS NULL OR quantity BETWEEN 0 AND 1000000), PRIMARY KEY(product_id,image_url,size))`;
const IMAGE_STOCK_CLEANUP = `CREATE TRIGGER IF NOT EXISTS image_stock_cleanup AFTER UPDATE OF data ON products BEGIN
  DELETE FROM image_stock WHERE product_id=NEW.id AND (
    (NOT EXISTS (SELECT 1 FROM json_each(NEW.data,'$.images') j WHERE j.value=image_url)
      AND NOT (NOT EXISTS (SELECT 1 FROM json_each(NEW.data,'$.images') valid WHERE valid.type='text' AND length(trim(valid.value))>0) AND COALESCE(json_extract(NEW.data,'$.cutout'),'')=image_url))
    OR NOT EXISTS (SELECT 1 FROM json_each(NEW.data,'$.sizes') s WHERE json_extract(s.value,'$.ml')=image_stock.size)
  );
END`;
async function ensureImageStock(db:D1Database):Promise<void> {
  await db.prepare(IMAGE_STOCK_TABLE).run();
  await db.prepare(IMAGE_STOCK_CLEANUP).run();
}

async function initialize(db: D1Database): Promise<void> {
  let initialized = false;
  try {
    const meta = await db.prepare("SELECT value FROM store_meta WHERE key='seed_v2'").first<{ value: string }>();
    initialized = meta?.value === '1';
  } catch {
    // Base tables or store_meta do not exist yet.
  }
  if (initialized) {
    // Existing databases also need the additive table before accepting new orders.
    await db.prepare(DDL_STATEMENTS.find(sql => sql.includes('CREATE TABLE IF NOT EXISTS hidden_studio_orders'))!).run();
    await db.prepare(DDL_STATEMENTS.find(sql => sql.includes('CREATE INDEX IF NOT EXISTS audit_log_order_confirmation'))!).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS order_contacts (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE, additional_phone TEXT NOT NULL)`).run();
    for (const sql of DDL_STATEMENTS.filter(statement => /analytics_daily|analytics_actions|analytics_presence/.test(statement) || /analytics_profiles|analytics_profile_events|analytics_profile_revocations/.test(statement))) await db.prepare(sql).run();
    await ensureDiscountRules(db);
    await ensureFixedDiscountRules(db);
    await ensureImageStock(db);
    await applyVlorBrandMigration(db);
    await ensureRequestedScents(db);
    await removeOldImages(db);
    readyDb = db;
    return;
  }

  for (const sql of DDL_STATEMENTS) {
    await db.prepare(sql).run();
  }
  for (const sql of ALTER_COLUMNS) {
    try {
      await db.prepare(sql).run();
    } catch {
      // Column already exists on migrated databases.
    }
  }
  for (const sql of TRIGGER_STATEMENTS) {
    await db.prepare(sql).run();
  }

  await ensureDiscountRules(db);
  await ensureFixedDiscountRules(db);
  await ensureImageStock(db);

  // Seed initial bootstrap owner ('admin') only if no admin accounts exist yet,
  // or refresh the untouched bootstrap hash to 100k PBKDF2 iterations if still awaiting first password change.
  const adminCount = (await db.prepare('SELECT COUNT(*) AS n FROM admins').first<{ n: number }>())?.n ?? 0;
  if (adminCount === 0) {
    await db
      .prepare('INSERT OR IGNORE INTO admins(id, username, salt, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?, 1)')
      .bind(INITIAL_ADMIN.id, INITIAL_ADMIN.username, INITIAL_ADMIN.salt, INITIAL_ADMIN.passwordHash, 'owner')
      .run();
  } else {
    await db
      .prepare('UPDATE admins SET salt = ?, password_hash = ? WHERE id = ? AND must_change_password = 1')
      .bind(INITIAL_ADMIN.salt, INITIAL_ADMIN.passwordHash, INITIAL_ADMIN.id)
      .run();
  }

  // Seed bottle images + 12 perfume products + initial stock only if catalogue is empty.
  const productCount = (await db.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>())?.n ?? 0;
  if (productCount === 0) {
    for (const img of SEED_IMAGES) {
      await db
        .prepare('INSERT OR IGNORE INTO images(key, content_type, data_base64, size) VALUES (?, ?, ?, ?)')
        .bind(img.key, img.contentType, img.base64, img.size)
        .run();
    }
    const productBatch: D1PreparedStatement[] = [];
    SEED_PRODUCTS.forEach((p, idx) => {
      const ts = `2026-10-29 12:${String(59 - idx).padStart(2, '0')}:00`;
      productBatch.push(
        db
          .prepare('INSERT OR IGNORE INTO products(id, slug, category_id, data, archived, updated_at) VALUES (?, ?, ?, ?, 0, ?)')
          .bind(p.id, p.slug, p.category, JSON.stringify(p), ts)
      );
      for (const s of p.sizes) {
        productBatch.push(
          db
            .prepare('INSERT INTO inventory(product_id, size, quantity) VALUES (?, ?, 25) ON CONFLICT(product_id, size) DO UPDATE SET quantity = CASE WHEN inventory.quantity = 0 THEN 25 ELSE inventory.quantity END')
            .bind(p.id, s.ml)
        );
      }
    });
    // Requested scents start with zero stock; inventory triggers create each size.
    NEW_PRODUCTS.forEach((p) => {
      productBatch.push(
        db.prepare('INSERT OR IGNORE INTO products(id, slug, category_id, data) VALUES (?, ?, ?, ?)')
          .bind(p.id, p.slug, p.category, JSON.stringify(p))
      );
    });
    await db.batch(productBatch);
  }

  // Seed shipping rates for all 27 Egyptian governorates if none are configured yet.
  const shippingCount = (await db.prepare('SELECT COUNT(*) AS n FROM shipping_rates').first<{ n: number }>())?.n ?? 0;
  if (shippingCount === 0) {
    await db.batch(
      SEED_SHIPPING_RATES.map(([city, amount, threshold]) =>
        db.prepare('INSERT OR IGNORE INTO shipping_rates(city, amount, free_threshold) VALUES (?, ?, ?)').bind(city, amount, threshold)
      )
    );
  }

  await db.batch([
    db.prepare("INSERT OR REPLACE INTO store_meta(key, value) VALUES ('seed_v2', '1')"),
    db.prepare("INSERT OR REPLACE INTO store_meta(key, value) VALUES ('rebrand_vlor_v2', '1')"),
  ]);
  await ensureRequestedScents(db);
  await removeOldImages(db);
  readyDb = db;
}

export async function ensureStoreReady(db: D1Database): Promise<void> {
  if (readyDb === db) return;
  if (!pendingInit) {
    pendingInit = initialize(db).finally(() => {
      pendingInit = null;
    });
  }
  await pendingInit;
}
