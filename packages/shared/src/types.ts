// ============================================================
// Source data types — from ~/.claude/ JSONL files
// ============================================================

export interface ClaudeHistoryEntry {
  display: string;
  pastedContents: unknown;
  timestamp: string;
  project: string;
  sessionId?: string;
}

export interface SessionIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  firstPrompt: string;
  summary: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
}

export interface SessionIndexFile {
  version: number;
  entries: SessionIndexEntry[];
}

export type JournalEntryType =
  | "user"
  | "assistant"
  | "progress"
  | "system"
  | "permission-mode"
  | "file-history-snapshot"
  | "attachment"
  | "queue-operation"
  | "last-prompt";

export interface JournalEntryBase {
  type: JournalEntryType;
  uuid?: string;
  parentUuid?: string;
  timestamp?: string;
  sessionId?: string;
  version?: number;
  gitBranch?: string;
  slug?: string;
  cwd?: string;
  userType?: string;
  isSidechain?: boolean;
}

// Content block subtypes

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: number;
  service_tier?: string;
}

export interface UserEntry extends JournalEntryBase {
  type: "user";
  message: {
    role: "user";
    content: string | ContentBlock[];
  };
}

export interface AssistantEntry extends JournalEntryBase {
  type: "assistant";
  requestId?: string;
  message: {
    model: string;
    id: string;
    type: "message";
    role: "assistant";
    content: ContentBlock[];
    stop_reason: string;
    usage: TokenUsage;
  };
}

export interface ProgressEntry extends JournalEntryBase {
  type: "progress";
  parentToolUseID?: string;
  toolUseID?: string;
  data: {
    type: string;
    output?: string;
    fullOutput?: string;
    elapsedTimeSeconds?: number;
    [key: string]: unknown;
  };
}

export interface SystemEntry extends JournalEntryBase {
  type: "system";
  subtype?: string;
  durationMs?: number;
  hookCount?: number;
  [key: string]: unknown;
}

export type JournalEntry =
  | UserEntry
  | AssistantEntry
  | ProgressEntry
  | SystemEntry
  | JournalEntryBase;

// ============================================================
// Database row types
// ============================================================

export interface SessionRow {
  id: string;
  project_path: string;
  project_name: string;
  slug: string;
  git_branch: string;
  first_prompt: string;
  summary: string;
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  total_cost: number;
  model: string;
  cc_version: string;
  user_id: string;
  created_at: string;
  modified_at: string;
  duration_seconds: number;
}

export interface MessageRow {
  id: string;
  session_id: string;
  parent_uuid: string;
  role: string;
  content_text: string;
  has_thinking: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  model: string;
  timestamp: string;
}

export interface ToolUseRow {
  id: string;
  message_id: string;
  session_id: string;
  tool_name: string;
  input_json: string;
  output_text: string;
  is_error: number;
  timestamp: string;
}

export interface InsightRow {
  id: number;
  session_id: string | null;
  insight_type: string;
  content: string;
  created_at: string;
}

// ============================================================
// API response types
// ============================================================

export interface DashboardStats {
  sessions: number;
  messages: number;
  totalTokens: number;
  totalCost: number;
  avgDurationSeconds: number;
  sessionsTrend: number;
  messageTrend: number;
  tokensTrend: number;
  costTrend: number;
}

export interface ChartDataPoint {
  date: string;
  sessions: number;
  tokens: number;
  cost: number;
}

export interface ToolBreakdown {
  tool_name: string;
  count: number;
  percentage: number;
}

export interface SearchResult {
  sessionId: string;
  slug: string;
  projectName: string;
  snippet: string;
  score: number;
  createdAt: string;
  messageCount: number;
  totalCost: number;
}

// ============================================================
// Config types
// ============================================================

export interface AppConfig {
  llm: {
    provider: string;
    embeddingModel: string;
    completionModel: string;
    ollamaUrl: string;
    openrouterKey?: string;
    anthropicKey?: string;
    openaiKey?: string;
  };
  redaction: {
    defaultRules: string[];
  };
  import: {
    claudeDir: string;
    dbPath: string;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "ollama",
    embeddingModel: "nomic-embed-text",
    completionModel: "llama3.2",
    ollamaUrl: "http://localhost:11434",
  },
  redaction: {
    defaultRules: [],
  },
  import: {
    claudeDir: "~/.claude",
    dbPath: "~/.cclog/db.sqlite",
  },
};
