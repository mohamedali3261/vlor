-- Hide orders in the studio without changing stock, history, or tracking.
CREATE TABLE IF NOT EXISTS hidden_studio_orders (order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE, hidden_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS audit_log_order_confirmation ON audit_log(target_id,action);
