import type Database from "better-sqlite3";
import type {
  SessionRow,
  MessageRow,
  ToolUseRow,
  DashboardStats,
} from "@cclog/shared";

// ---------------------------------------------------------------------------
// StatsFilters
// ---------------------------------------------------------------------------

export interface StatsFilters {
  since?: string;
  until?: string;
  projectPath?: string;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function insertSession(db: Database.Database, s: SessionRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO sessions (
      id, project_path, project_name, slug, git_branch, first_prompt,
      summary, message_count, total_input_tokens, total_output_tokens,
      total_cache_read_tokens, total_cache_creation_tokens, total_cost,
      model, cc_version, user_id, created_at, modified_at, duration_seconds
    ) VALUES (
      @id, @project_path, @project_name, @slug, @git_branch, @first_prompt,
      @summary, @message_count, @total_input_tokens, @total_output_tokens,
      @total_cache_read_tokens, @total_cache_creation_tokens, @total_cost,
      @model, @cc_version, @user_id, @created_at, @modified_at, @duration_seconds
    )
  `).run(s);
}

export function getSessionById(
  db: Database.Database,
  id: string
): SessionRow | undefined {
  return db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function insertMessage(db: Database.Database, m: MessageRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO messages (
      id, session_id, parent_uuid, role, content_text, has_thinking,
      input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
      model, timestamp
    ) VALUES (
      @id, @session_id, @parent_uuid, @role, @content_text, @has_thinking,
      @input_tokens, @output_tokens, @cache_read_tokens, @cache_creation_tokens,
      @model, @timestamp
    )
  `).run(m);
}

export function getMessagesBySessionId(
  db: Database.Database,
  sessionId: string
): MessageRow[] {
  return db
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp")
    .all(sessionId) as MessageRow[];
}

// ---------------------------------------------------------------------------
// Tool uses
// ---------------------------------------------------------------------------

export function insertToolUse(db: Database.Database, t: ToolUseRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO tool_uses (
      id, message_id, session_id, tool_name, input_json, output_text,
      is_error, timestamp
    ) VALUES (
      @id, @message_id, @session_id, @tool_name, @input_json, @output_text,
      @is_error, @timestamp
    )
  `).run(t);
}

export function getToolUsesBySessionId(
  db: Database.Database,
  sessionId: string
): ToolUseRow[] {
  return db
    .prepare(
      "SELECT * FROM tool_uses WHERE session_id = ? ORDER BY timestamp"
    )
    .all(sessionId) as ToolUseRow[];
}

// ---------------------------------------------------------------------------
// Search index
// ---------------------------------------------------------------------------

export function insertSearchEntry(
  db: Database.Database,
  sessionId: string,
  content: string,
  contentType: string
): void {
  db.prepare(
    "INSERT INTO search_index (session_id, content, content_type) VALUES (?, ?, ?)"
  ).run(sessionId, content, contentType);
}

// ---------------------------------------------------------------------------
// Import state
// ---------------------------------------------------------------------------

export function getImportState(
  db: Database.Database,
  key: string
): string | undefined {
  const row = db
    .prepare("SELECT value FROM import_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setImportState(
  db: Database.Database,
  key: string,
  value: string
): void {
  db.prepare(
    "INSERT OR REPLACE INTO import_state (key, value) VALUES (?, ?)"
  ).run(key, value);
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

function buildWhereClause(filters: StatsFilters): {
  clause: string;
  params: Record<string, string>;
} {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filters.since) {
    conditions.push("created_at >= @since");
    params.since = filters.since;
  }
  if (filters.until) {
    conditions.push("created_at <= @until");
    params.until = filters.until;
  }
  if (filters.projectPath) {
    conditions.push("project_path = @projectPath");
    params.projectPath = filters.projectPath;
  }
  if (filters.userId) {
    conditions.push("user_id = @userId");
    params.userId = filters.userId;
  }

  const clause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { clause, params };
}

interface RawStats {
  sessions: number | null;
  messages: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalCacheReadTokens: number | null;
  totalCacheCreationTokens: number | null;
  totalCost: number | null;
  avgDuration: number | null;
}

export function getDashboardStats(
  db: Database.Database,
  filters: StatsFilters
): DashboardStats {
  const { clause, params } = buildWhereClause(filters);

  const raw = db
    .prepare(`
      SELECT
        COUNT(*) AS sessions,
        SUM(message_count) AS messages,
        SUM(total_input_tokens) AS totalInputTokens,
        SUM(total_output_tokens) AS totalOutputTokens,
        SUM(total_cache_read_tokens) AS totalCacheReadTokens,
        SUM(total_cache_creation_tokens) AS totalCacheCreationTokens,
        SUM(total_cost) AS totalCost,
        AVG(duration_seconds) AS avgDuration
      FROM sessions
      ${clause}
    `)
    .get(params) as RawStats;

  const sessions = raw.sessions ?? 0;
  const messages = raw.messages ?? 0;
  const totalTokens =
    (raw.totalInputTokens ?? 0) +
    (raw.totalOutputTokens ?? 0) +
    (raw.totalCacheReadTokens ?? 0) +
    (raw.totalCacheCreationTokens ?? 0);
  const totalCost = raw.totalCost ?? 0;
  const avgDurationSeconds = raw.avgDuration ?? 0;

  // Trend fields: not enough temporal info in filters alone to compute a
  // meaningful prior period, so default to 0 (no trend data available).
  return {
    sessions,
    messages,
    totalTokens,
    totalCost,
    avgDurationSeconds,
    sessionsTrend: 0,
    messageTrend: 0,
    tokensTrend: 0,
    costTrend: 0,
  };
}
