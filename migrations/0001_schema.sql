CREATE TABLE students (
  student_id TEXT PRIMARY KEY, prefix TEXT NOT NULL DEFAULT '', first_name TEXT NOT NULL,
  last_name TEXT NOT NULL, level TEXT NOT NULL, grade TEXT NOT NULL, room TEXT NOT NULL
);
CREATE TABLE products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  price REAL NOT NULL CHECK(price > 0 AND price <= 10000), category TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE orders (
  order_id TEXT PRIMARY KEY, student_id TEXT NOT NULL UNIQUE REFERENCES students(student_id),
  student_name TEXT NOT NULL, grade TEXT NOT NULL, room TEXT NOT NULL,
  budget REAL NOT NULL, total_amount REAL NOT NULL CHECK(total_amount >= 0),
  extra_amount REAL NOT NULL DEFAULT 0, order_date TEXT NOT NULL
);
CREATE TABLE order_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL, product_name TEXT NOT NULL, price REAL NOT NULL CHECK(price > 0),
  quantity INTEGER NOT NULL CHECK(quantity > 0)
);
CREATE INDEX idx_items_order ON order_items(order_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE TABLE admin_sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, last_activity INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE login_attempts (username TEXT PRIMARY KEY, fail_count INTEGER NOT NULL DEFAULT 0, last_fail INTEGER NOT NULL);
