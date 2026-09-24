-- Existing orders retain no acknowledgement; never infer consent retroactively.
ALTER TABLE orders ADD COLUMN unused_budget_acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(unused_budget_acknowledged IN (0,1));
ALTER TABLE orders ADD COLUMN unused_budget_acknowledged_at TEXT;
