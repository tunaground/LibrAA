-- Series
CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS series_i18n (
  series_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  name TEXT,
  author TEXT,
  link TEXT,
  PRIMARY KEY (series_id, locale),
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_tags (
  series_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (series_id, tag),
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

-- Threads
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  series_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS thread_i18n (
  thread_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  name TEXT,
  author TEXT,
  first_posted_at TEXT,
  last_posted_at TEXT,
  link TEXT,
  PRIMARY KEY (thread_id, locale),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS thread_tags (
  thread_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (thread_id, tag),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- Responses
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sequence INTEGER,
  posted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS response_i18n (
  response_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  author_name TEXT,
  author_id TEXT,
  body TEXT,
  PRIMARY KEY (response_id, locale),
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE
);
