import type Database from "better-sqlite3";

export function initializeDatabase(db: Database.Database): void {
  // Performance and integrity pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                        TEXT    PRIMARY KEY,
      project_path              TEXT    NOT NULL,
      project_name              TEXT    NOT NULL,
      slug                      TEXT    DEFAULT '',
      git_branch                TEXT    DEFAULT '',
      first_prompt              TEXT    DEFAULT '',
      summary                   TEXT    DEFAULT '',
      message_count             INTEGER DEFAULT 0,
      total_input_tokens        INTEGER DEFAULT 0,
      total_output_tokens       INTEGER DEFAULT 0,
      total_cache_read_tokens   INTEGER DEFAULT 0,
      total_cache_creation_tokens INTEGER DEFAULT 0,
      total_cost                REAL    DEFAULT 0,
      model                     TEXT    DEFAULT '',
      cc_version                TEXT    DEFAULT '',
      user_id                   TEXT    DEFAULT '',
      created_at                TEXT    NOT NULL,
      modified_at               TEXT    NOT NULL,
      duration_seconds          INTEGER DEFAULT 0
    )
  `);

  // messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id                    TEXT    PRIMARY KEY,
      session_id            TEXT    REFERENCES sessions(id) ON DELETE CASCADE,
      parent_uuid           TEXT    DEFAULT '',
      role                  TEXT    NOT NULL,
      content_text          TEXT    DEFAULT '',
      has_thinking          INTEGER DEFAULT 0,
      input_tokens          INTEGER DEFAULT 0,
      output_tokens         INTEGER DEFAULT 0,
      cache_read_tokens     INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      model                 TEXT    DEFAULT '',
      timestamp             TEXT    NOT NULL
    )
  `);

  // tool_uses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_uses (
      id          TEXT    PRIMARY KEY,
      message_id  TEXT    REFERENCES messages(id) ON DELETE CASCADE,
      session_id  TEXT    REFERENCES sessions(id) ON DELETE CASCADE,
      tool_name   TEXT    NOT NULL,
      input_json  TEXT    DEFAULT '{}',
      output_text TEXT    DEFAULT '',
      is_error    INTEGER DEFAULT 0,
      timestamp   TEXT    DEFAULT ''
    )
  `);

  // embeddings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT    REFERENCES sessions(id) ON DELETE CASCADE,
      message_id  TEXT,
      text_chunk  TEXT    NOT NULL,
      embedding   BLOB,
      chunk_type  TEXT    NOT NULL
    )
  `);

  // insights table
  db.exec(`
    CREATE TABLE IF NOT EXISTS insights (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      insight_type TEXT    NOT NULL,
      content      TEXT    NOT NULL,
      created_at   TEXT    NOT NULL
    )
  `);

  // import_state table
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_project_path ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at   ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id      ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session_id   ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session_role ON messages(session_id, role);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp    ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tool_uses_session_id  ON tool_uses(session_id);
    CREATE INDEX IF NOT EXISTS idx_tool_uses_tool_name   ON tool_uses(tool_name);
  `);

  // FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      session_id,
      content,
      content_type,
      tokenize = 'porter unicode61'
    )
  `);
}
