PRAGMA defer_foreign_keys = ON;
CREATE TABLE terms (
  term_id TEXT PRIMARY KEY,
  academic_year INTEGER,
  semester INTEGER,
  opens_at TEXT,
  closes_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0,1)),
  announcement TEXT NOT NULL DEFAULT '',
  CHECK((academic_year IS NULL AND semester IS NULL) OR (academic_year BETWEEN 2500 AND 2700 AND semester IN (1,2))),
  CHECK((opens_at IS NULL AND closes_at IS NULL) OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND julianday(opens_at) < julianday(closes_at))),
  UNIQUE(academic_year, semester)
);
CREATE UNIQUE INDEX one_current_term ON terms(is_current) WHERE is_current=1;
-- Preserve the old ordering state without inventing a semester or deadline.
INSERT INTO terms(term_id,enabled,is_current) VALUES('legacy',1,1);

CREATE TABLE orders_next (
  order_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(student_id),
  student_name TEXT NOT NULL, grade TEXT NOT NULL, room TEXT NOT NULL,
  budget REAL NOT NULL, total_amount REAL NOT NULL CHECK(total_amount>=0),
  extra_amount REAL NOT NULL DEFAULT 0, order_date TEXT NOT NULL,
  unused_budget_acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(unused_budget_acknowledged IN (0,1)),
  unused_budget_acknowledged_at TEXT,
  term_id TEXT NOT NULL DEFAULT 'legacy' REFERENCES terms(term_id),
  UNIQUE(student_id,term_id)
);
INSERT INTO orders_next SELECT orders.*, 'legacy' FROM orders;
CREATE TABLE order_items_next (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders_next(order_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL, product_name TEXT NOT NULL,
  price REAL NOT NULL CHECK(price>0), quantity INTEGER NOT NULL CHECK(quantity>0)
);
INSERT INTO order_items_next SELECT * FROM order_items;
DROP TABLE order_items;
DROP TABLE orders;
ALTER TABLE orders_next RENAME TO orders;
ALTER TABLE order_items_next RENAME TO order_items;
CREATE INDEX idx_items_order ON order_items(order_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_term_date ON orders(term_id,order_date);
-- Enforce the deadline and current semester inside the transaction as well.
CREATE TRIGGER orders_check_period BEFORE INSERT ON orders
WHEN NOT EXISTS (
  SELECT 1 FROM terms WHERE term_id=NEW.term_id AND is_current=1 AND enabled=1
  AND (opens_at IS NULL OR julianday('now')>=julianday(opens_at))
  AND (closes_at IS NULL OR julianday('now')<julianday(closes_at))
)
BEGIN SELECT RAISE(ABORT,'ordering_period_closed'); END;
