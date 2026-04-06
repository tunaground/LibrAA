-- Recreate threads table with ON DELETE CASCADE for series_id
CREATE TABLE threads_new (
  id TEXT PRIMARY KEY,
  series_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

INSERT INTO threads_new SELECT * FROM threads;
DROP TABLE threads;
ALTER TABLE threads_new RENAME TO threads;
