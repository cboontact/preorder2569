"""Convert the project's phpMyAdmin snapshot to a validated D1 data migration.
Run before deploying to a NEW database. Existing migrations must not be rewritten after deployment.
"""
from pathlib import Path
import re
import sqlite3
from datetime import datetime, timezone, timedelta

root = Path(__file__).resolve().parent.parent
source = root / 'legacy/products.sql'
db = sqlite3.connect(':memory:')
db.executescript((root / 'migrations/0001_schema.sql').read_text())
tables = ['products', 'students', 'orders', 'order_items']
for table in tables:
    statements = re.findall(r'INSERT INTO `' + table + r'` .*?;\s*(?=\n)', source.read_text(), re.S)
    if len(statements) != 1:
        raise ValueError(f'Expected one INSERT for {table}; inspect source before continuing')
    db.executescript(statements[0])
for oid, value in db.execute('SELECT order_id, order_date FROM orders').fetchall():
    try:
        date = datetime.strptime(value, '%d/%m/%Y, %H:%M:%S').replace(tzinfo=timezone(timedelta(hours=7)))
    except ValueError:
        date = datetime.fromisoformat(value)
    db.execute('UPDATE orders SET order_date=? WHERE order_id=?', (date.isoformat(), oid))
assert not db.execute('PRAGMA foreign_key_check').fetchall()
assert not db.execute('SELECT student_id FROM orders GROUP BY student_id HAVING count(*) > 1').fetchall()
assert not db.execute('SELECT o.order_id FROM orders o JOIN order_items i USING(order_id) GROUP BY o.order_id HAVING abs(o.total_amount-sum(i.price*i.quantity)) > 0.01').fetchall()
lines = ['-- Imported from the supplied products.sql snapshot (2026-03-07).', '-- No admin credentials or sessions are imported.']
for table in tables:
    columns = [r[1] for r in db.execute(f'PRAGMA table_info({table})')]
    for row in db.execute(f'SELECT * FROM {table}'):
        values = ','.join('NULL' if v is None else str(v) if isinstance(v, (int,float)) else "'"+v.replace("'", "''")+"'" for v in row)
        lines.append(f'INSERT INTO {table} ({",".join(columns)}) VALUES ({values});')
    print(table, db.execute(f'SELECT count(*) FROM {table}').fetchone()[0])
(root / 'migrations/0002_legacy_data.sql').write_text('\n'.join(lines)+'\n')
