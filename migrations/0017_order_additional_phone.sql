-- Optional contact numbers for new orders; existing order and stock records are untouched.
CREATE TABLE IF NOT EXISTS order_contacts (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  additional_phone TEXT NOT NULL
);
