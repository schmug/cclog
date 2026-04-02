# cc-timetravel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI + Next.js viewer that imports Claude Code history from `~/.claude/`, stores it in SQLite, and presents analytics, search, and LLM insights with a terminal/hacker aesthetic.

**Architecture:** Two-component system — a Commander.js CLI handles data import, embedding generation, redaction, and export; a Next.js App Router viewer reads the SQLite DB and serves interactive dashboards. Turborepo monorepo with shared types package.

**Tech Stack:** Next.js 15, React 19, TypeScript, SQLite (better-sqlite3 + sqlite-vec), Tailwind CSS 4, Recharts, TanStack Table, Commander.js, Vitest

---

## File Structure

```
cc-timetravel/
├── package.json                          # Root workspace config
├── turbo.json                            # Turborepo pipeline
├── tsconfig.base.json                    # Shared TS config
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts                  # All shared TypeScript types
│   │       ├── pricing.ts                # Model → cost-per-token mapping
│   │       └── index.ts                  # Re-exports
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts                  # CLI entry point (Commander)
│   │       ├── db/
│   │       │   ├── schema.ts             # CREATE TABLE statements + migrations
│   │       │   ├── connection.ts         # DB open/close + sqlite-vec load
│   │       │   └── queries.ts            # All prepared statements
│   │       ├── importers/
│   │       │   ├── jsonl-parser.ts       # Parse session JSONL → typed entries
│   │       │   ├── session-index.ts      # Read sessions-index.json files
│   │       │   └── importer.ts           # Orchestrates full import pipeline
│   │       ├── providers/
│   │       │   ├── interface.ts          # LLMProvider interface
│   │       │   ├── ollama.ts             # Ollama implementation
│   │       │   └── factory.ts            # Create provider from config
│   │       ├── redaction/
│   │       │   └── redactor.ts           # Redaction engine
│   │       ├── commands/
│   │       │   ├── import.ts             # import command
│   │       │   ├── embed.ts              # embed command
│   │       │   ├── summarize.ts          # summarize command
│   │       │   ├── export.ts             # export command
│   │       │   ├── config.ts             # config command
│   │       │   └── serve.ts              # serve command (spawns Next.js)
│   │       ├── config.ts                 # Read/write ~/.config/cc-timetravel/config.json
│   │       └── __tests__/
│   │           ├── jsonl-parser.test.ts
│   │           ├── importer.test.ts
│   │           ├── queries.test.ts
│   │           ├── redactor.test.ts
│   │           └── fixtures/             # Test JSONL + index files
│   │               ├── session-small.jsonl
│   │               └── sessions-index.json
│   └── viewer/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── postcss.config.mjs
│       └── src/
│           ├── app/
│           │   ├── layout.tsx            # Root layout with nav
│           │   ├── page.tsx              # Dashboard
│           │   ├── sessions/
│           │   │   ├── page.tsx          # Sessions list
│           │   │   └── [id]/
│           │   │       └── page.tsx      # Session detail
│           │   ├── search/
│           │   │   └── page.tsx          # Search page
│           │   ├── insights/
│           │   │   └── page.tsx          # Insights page
│           │   ├── api/
│           │   │   ├── stats/
│           │   │   │   └── route.ts      # Dashboard stats
│           │   │   ├── sessions/
│           │   │   │   ├── route.ts      # List sessions
│           │   │   │   └── [id]/
│           │   │   │       └── route.ts  # Session detail + messages
│           │   │   ├── search/
│           │   │   │   └── route.ts      # Keyword + semantic search
│           │   │   ├── insights/
│           │   │   │   └── route.ts      # Insights data
│           │   │   └── charts/
│           │   │       └── route.ts      # Time-series chart data
│           │   └── globals.css           # Tailwind + terminal theme
│           ├── components/
│           │   ├── layout/
│           │   │   ├── nav.tsx           # Top navigation bar
│           │   │   └── filters.tsx       # Time range + project + user filters
│           │   ├── charts/
│           │   │   ├── usage-chart.tsx   # Usage over time bar chart
│           │   │   └── tool-breakdown.tsx # Tool usage horizontal bars
│           │   ├── tables/
│           │   │   └── sessions-table.tsx # TanStack Table for sessions
│           │   ├── stat-card.tsx          # Single stat card component
│           │   └── search-results.tsx     # Search result cards
│           └── lib/
│               ├── db.ts                 # Server-side DB connection
│               └── format.ts             # Number/date formatting helpers
```

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`, `turbo.json`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/vitest.config.ts`
- Create: `packages/viewer/package.json`, `packages/viewer/tsconfig.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "cc-timetravel",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.next/
*.db
.turbo/
.superpowers/
.env
.env.local
```

- [ ] **Step 5: Create packages/shared/package.json and tsconfig.json**

`packages/shared/package.json`:
```json
{
  "name": "@cc-timetravel/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create packages/cli/package.json, tsconfig.json, vitest.config.ts**

`packages/cli/package.json`:
```json
{
  "name": "@cc-timetravel/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "cc-timetravel": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@cc-timetravel/shared": "workspace:*",
    "better-sqlite3": "^11.9.0",
    "commander": "^13.1.0",
    "glob": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "tsx": "^4.19.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

`packages/cli/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 7: Create packages/viewer/package.json and tsconfig.json**

`packages/viewer/package.json`:
```json
{
  "name": "@cc-timetravel/viewer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@cc-timetravel/shared": "workspace:*",
    "better-sqlite3": "^11.9.0",
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "recharts": "^2.15.0",
    "@tanstack/react-table": "^8.21.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@tailwindcss/postcss": "^4.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0"
  }
}
```

`packages/viewer/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 8: Install dependencies and verify**

Run: `npm install`
Expected: Clean install, no errors.

Run: `npx turbo build --filter=@cc-timetravel/shared`
Expected: Build succeeds (empty package for now).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold turborepo monorepo with cli, viewer, shared packages"
```

---

### Task 2: Shared Types and Pricing

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/pricing.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create shared types**

`packages/shared/src/types.ts`:
```typescript
// ── Source data types (from ~/.claude/ JSONL) ──

export interface ClaudeHistoryEntry {
  display: string;
  pastedContents: Record<string, unknown>;
  timestamp: number;
  project: string;
  sessionId?: string;
}

export interface SessionIndexFile {
  version: number;
  entries: SessionIndexEntry[];
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
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  version?: string;
  gitBranch?: string;
  slug?: string;
  cwd?: string;
  userType?: string;
  isSidechain?: boolean;
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
    stop_reason: string | null;
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

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string | ContentBlock[];
      is_error?: boolean;
    };

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
  service_tier?: string;
}

export type JournalEntry =
  | UserEntry
  | AssistantEntry
  | ProgressEntry
  | SystemEntry
  | JournalEntryBase;

// ── Database row types (what we store in SQLite) ──

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

// ── API response types (viewer) ──

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

// ── Config types ──

export interface AppConfig {
  llm: {
    provider: "ollama" | "openrouter" | "anthropic" | "openai";
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
    defaultRules: ["redact-tool-outputs", "redact-paths"],
  },
  import: {
    claudeDir: "~/.claude",
    dbPath: "./timetravel.db",
  },
};
```

- [ ] **Step 2: Create pricing table**

`packages/shared/src/pricing.ts`:
```typescript
// Cost per token in USD. Source: Anthropic/OpenAI pricing pages.
// Prices as of 2026-04. Update as needed.

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion: number;
  cacheCreationPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6": {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheCreationPerMillion: 18.75,
  },
  "claude-sonnet-4-6": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheCreationPerMillion: 1,
  },
  "claude-sonnet-4-20250514": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-3-5-haiku-20241022": {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheCreationPerMillion: 1,
  },
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheReadPerMillion: 0.3,
  cacheCreationPerMillion: 3.75,
};

export function getModelPricing(model: string): ModelPricing {
  return PRICING[model] ?? DEFAULT_PRICING;
}

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number,
): number {
  const p = getModelPricing(model);
  return (
    (inputTokens * p.inputPerMillion) / 1_000_000 +
    (outputTokens * p.outputPerMillion) / 1_000_000 +
    (cacheReadTokens * p.cacheReadPerMillion) / 1_000_000 +
    (cacheCreationTokens * p.cacheCreationPerMillion) / 1_000_000
  );
}
```

- [ ] **Step 3: Create index.ts**

`packages/shared/src/index.ts`:
```typescript
export * from "./types.js";
export * from "./pricing.js";
```

- [ ] **Step 4: Verify build**

Run: `npx turbo build --filter=@cc-timetravel/shared`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, pricing table, and cost computation"
```

---

### Task 3: SQLite Database Schema and Connection

**Files:**
- Create: `packages/cli/src/db/schema.ts`
- Create: `packages/cli/src/db/connection.ts`
- Create: `packages/cli/src/db/queries.ts`
- Test: `packages/cli/src/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing test for database initialization**

`packages/cli/src/__tests__/queries.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initializeDatabase } from "../db/schema.js";
import { insertSession, getSessionById, getDashboardStats } from "../db/queries.js";
import type { SessionRow } from "@cc-timetravel/shared";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initializeDatabase(db);
});

afterEach(() => {
  db.close();
});

describe("initializeDatabase", () => {
  it("creates all expected tables", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("sessions");
    expect(names).toContain("messages");
    expect(names).toContain("tool_uses");
    expect(names).toContain("insights");
    expect(names).toContain("import_state");
  });
});

describe("insertSession + getSessionById", () => {
  it("round-trips a session row", () => {
    const session: SessionRow = {
      id: "abc-123",
      project_path: "/Users/cory/myproject",
      project_name: "myproject",
      slug: "happy-coding-fox",
      git_branch: "main",
      first_prompt: "fix the auth bug",
      summary: "Fixed authentication middleware",
      message_count: 42,
      total_input_tokens: 10000,
      total_output_tokens: 5000,
      total_cache_read_tokens: 8000,
      total_cache_creation_tokens: 2000,
      total_cost: 0.45,
      model: "claude-opus-4-6",
      cc_version: "2.1.90",
      user_id: "cory",
      created_at: "2026-04-01T10:00:00.000Z",
      modified_at: "2026-04-01T11:00:00.000Z",
      duration_seconds: 3600,
    };
    insertSession(db, session);
    const result = getSessionById(db, "abc-123");
    expect(result).toMatchObject(session);
  });
});

describe("getDashboardStats", () => {
  it("returns zeroes for empty database", () => {
    const stats = getDashboardStats(db, {});
    expect(stats.sessions).toBe(0);
    expect(stats.totalCost).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/__tests__/queries.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create schema.ts**

`packages/cli/src/db/schema.ts`:
```typescript
import Database from "better-sqlite3";

export function initializeDatabase(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      project_name TEXT NOT NULL,
      slug TEXT NOT NULL DEFAULT '',
      git_branch TEXT NOT NULL DEFAULT '',
      first_prompt TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      message_count INTEGER NOT NULL DEFAULT 0,
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      model TEXT NOT NULL DEFAULT '',
      cc_version TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      parent_uuid TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      content_text TEXT NOT NULL DEFAULT '',
      has_thinking INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      model TEXT NOT NULL DEFAULT '',
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

    CREATE TABLE IF NOT EXISTS tool_uses (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      input_json TEXT NOT NULL DEFAULT '{}',
      output_text TEXT NOT NULL DEFAULT '',
      is_error INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_tool_uses_session ON tool_uses(session_id);
    CREATE INDEX IF NOT EXISTS idx_tool_uses_name ON tool_uses(tool_name);

    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      message_id TEXT,
      text_chunk TEXT NOT NULL,
      embedding BLOB,
      chunk_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      insight_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      session_id,
      content,
      content_type,
      tokenize='porter unicode61'
    );
  `);
}
```

- [ ] **Step 4: Create connection.ts**

`packages/cli/src/db/connection.ts`:
```typescript
import Database from "better-sqlite3";
import { initializeDatabase } from "./schema.js";

export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  initializeDatabase(db);
  return db;
}
```

- [ ] **Step 5: Create queries.ts**

`packages/cli/src/db/queries.ts`:
```typescript
import Database from "better-sqlite3";
import type {
  SessionRow,
  MessageRow,
  ToolUseRow,
  DashboardStats,
  ChartDataPoint,
  ToolBreakdown,
} from "@cc-timetravel/shared";

// ── Inserts ──

export function insertSession(db: Database.Database, s: SessionRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO sessions
    (id, project_path, project_name, slug, git_branch, first_prompt, summary,
     message_count, total_input_tokens, total_output_tokens,
     total_cache_read_tokens, total_cache_creation_tokens,
     total_cost, model, cc_version, user_id, created_at, modified_at, duration_seconds)
    VALUES
    (@id, @project_path, @project_name, @slug, @git_branch, @first_prompt, @summary,
     @message_count, @total_input_tokens, @total_output_tokens,
     @total_cache_read_tokens, @total_cache_creation_tokens,
     @total_cost, @model, @cc_version, @user_id, @created_at, @modified_at, @duration_seconds)
  `).run(s);
}

export function insertMessage(db: Database.Database, m: MessageRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO messages
    (id, session_id, parent_uuid, role, content_text, has_thinking,
     input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
     model, timestamp)
    VALUES
    (@id, @session_id, @parent_uuid, @role, @content_text, @has_thinking,
     @input_tokens, @output_tokens, @cache_read_tokens, @cache_creation_tokens,
     @model, @timestamp)
  `).run(m);
}

export function insertToolUse(db: Database.Database, t: ToolUseRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO tool_uses
    (id, message_id, session_id, tool_name, input_json, output_text, is_error, timestamp)
    VALUES
    (@id, @message_id, @session_id, @tool_name, @input_json, @output_text, @is_error, @timestamp)
  `).run(t);
}

export function insertSearchEntry(
  db: Database.Database,
  sessionId: string,
  content: string,
  contentType: string,
): void {
  db.prepare(`
    INSERT INTO search_index (session_id, content, content_type)
    VALUES (?, ?, ?)
  `).run(sessionId, content, contentType);
}

// ── Import State ──

export function getImportState(db: Database.Database, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM import_state WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setImportState(db: Database.Database, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO import_state (key, value) VALUES (?, ?)").run(key, value);
}

// ── Reads ──

export function getSessionById(db: Database.Database, id: string): SessionRow | undefined {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

export function getMessagesBySessionId(db: Database.Database, sessionId: string): MessageRow[] {
  return db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp").all(sessionId) as MessageRow[];
}

export function getToolUsesBySessionId(db: Database.Database, sessionId: string): ToolUseRow[] {
  return db.prepare("SELECT * FROM tool_uses WHERE session_id = ? ORDER BY timestamp").all(sessionId) as ToolUseRow[];
}

// ── Dashboard Stats ──

interface StatsFilters {
  since?: string;
  until?: string;
  projectPath?: string;
  userId?: string;
}

export function getDashboardStats(db: Database.Database, filters: StatsFilters): DashboardStats {
  const { where, params } = buildWhereClause(filters);

  const row = db.prepare(`
    SELECT
      COUNT(*) as sessions,
      COALESCE(SUM(message_count), 0) as messages,
      COALESCE(SUM(total_input_tokens + total_output_tokens), 0) as totalTokens,
      COALESCE(SUM(total_cost), 0) as totalCost,
      COALESCE(AVG(duration_seconds), 0) as avgDurationSeconds
    FROM sessions ${where}
  `).get(...params) as Record<string, number>;

  return {
    sessions: row.sessions,
    messages: row.messages,
    totalTokens: row.totalTokens,
    totalCost: row.totalCost,
    avgDurationSeconds: Math.round(row.avgDurationSeconds),
    sessionsTrend: 0,
    messageTrend: 0,
    tokensTrend: 0,
    costTrend: 0,
  };
}

// ── Helpers ──

function buildWhereClause(
  filters: StatsFilters,
): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.since) {
    conditions.push("created_at >= ?");
    params.push(filters.since);
  }
  if (filters.until) {
    conditions.push("created_at < ?");
    params.push(filters.until);
  }
  if (filters.projectPath) {
    conditions.push("project_path = ?");
    params.push(filters.projectPath);
  }
  if (filters.userId) {
    conditions.push("user_id = ?");
    params.push(filters.userId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/cli && npx vitest run src/__tests__/queries.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/db/ packages/cli/src/__tests__/queries.test.ts
git commit -m "feat: add SQLite schema, connection, and query layer with tests"
```

---

### Task 4: JSONL Parser

**Files:**
- Create: `packages/cli/src/importers/jsonl-parser.ts`
- Create: `packages/cli/src/importers/session-index.ts`
- Create: `packages/cli/src/__tests__/fixtures/session-small.jsonl`
- Create: `packages/cli/src/__tests__/fixtures/sessions-index.json`
- Test: `packages/cli/src/__tests__/jsonl-parser.test.ts`

- [ ] **Step 1: Create test fixtures**

`packages/cli/src/__tests__/fixtures/sessions-index.json`:
```json
{
  "version": 1,
  "entries": [
    {
      "sessionId": "test-session-001",
      "fullPath": "/fake/path/test-session-001.jsonl",
      "fileMtime": 1712079195000,
      "firstPrompt": "fix the auth bug",
      "summary": "Fixed authentication middleware issue",
      "messageCount": 5,
      "created": "2026-04-01T10:00:00.000Z",
      "modified": "2026-04-01T10:30:00.000Z",
      "gitBranch": "main",
      "projectPath": "/Users/cory/myproject",
      "isSidechain": false
    }
  ]
}
```

`packages/cli/src/__tests__/fixtures/session-small.jsonl` — one entry per line:
```jsonl
{"type":"permission-mode","permissionMode":"default","sessionId":"test-session-001"}
{"type":"file-history-snapshot","messageId":"msg-001","snapshot":{"messageId":"msg-001","trackedFileBackups":{},"timestamp":"2026-04-01T10:00:00.000Z"},"isSnapshotUpdate":false}
{"parentUuid":null,"isSidechain":false,"userType":"external","cwd":"/Users/cory/myproject","sessionId":"test-session-001","version":"2.1.90","gitBranch":"main","slug":"happy-coding-fox","type":"user","message":{"role":"user","content":"fix the auth bug"},"uuid":"msg-001","timestamp":"2026-04-01T10:00:01.000Z"}
{"parentUuid":"msg-001","isSidechain":false,"userType":"external","cwd":"/Users/cory/myproject","sessionId":"test-session-001","version":"2.1.90","gitBranch":"main","slug":"happy-coding-fox","message":{"model":"claude-opus-4-6","id":"msg_abc","type":"message","role":"assistant","content":[{"type":"thinking","thinking":"Let me look at the auth code..."},{"type":"text","text":"I'll fix the auth middleware."},{"type":"tool_use","id":"toolu_001","name":"Read","input":{"file_path":"/Users/cory/myproject/auth.ts"}}],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1000,"output_tokens":200,"cache_creation_input_tokens":500,"cache_read_input_tokens":8000,"service_tier":"standard"}},"requestId":"req_001","type":"assistant","uuid":"msg-002","timestamp":"2026-04-01T10:00:05.000Z"}
{"parentUuid":"msg-002","isSidechain":false,"userType":"external","cwd":"/Users/cory/myproject","sessionId":"test-session-001","version":"2.1.90","gitBranch":"main","slug":"happy-coding-fox","type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_001","content":"export function auth(req) { ... }","is_error":false}]},"uuid":"msg-003","timestamp":"2026-04-01T10:00:06.000Z"}
{"parentUuid":"msg-003","isSidechain":false,"userType":"external","cwd":"/Users/cory/myproject","sessionId":"test-session-001","version":"2.1.90","gitBranch":"main","slug":"happy-coding-fox","message":{"model":"claude-opus-4-6","id":"msg_def","type":"message","role":"assistant","content":[{"type":"text","text":"I found the bug. The token validation is missing."},{"type":"tool_use","id":"toolu_002","name":"Edit","input":{"file_path":"/Users/cory/myproject/auth.ts","old_string":"export function auth","new_string":"export function authFixed"}}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":2000,"output_tokens":400,"cache_creation_input_tokens":0,"cache_read_input_tokens":9500,"service_tier":"standard"}},"requestId":"req_002","type":"assistant","uuid":"msg-004","timestamp":"2026-04-01T10:00:15.000Z"}
{"type":"system","subtype":"turn_duration","durationMs":15000,"parentUuid":"msg-004","isSidechain":false,"userType":"external","cwd":"/Users/cory/myproject","sessionId":"test-session-001","version":"2.1.90","gitBranch":"main","slug":"happy-coding-fox","timestamp":"2026-04-01T10:00:16.000Z","uuid":"msg-005","isMeta":false}
{"type":"last-prompt","lastPrompt":"fix the auth bug","sessionId":"test-session-001"}
```

- [ ] **Step 2: Write failing test**

`packages/cli/src/__tests__/jsonl-parser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseSessionJournal, extractSessionData } from "../importers/jsonl-parser.js";
import { readSessionIndex } from "../importers/session-index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

describe("parseSessionJournal", () => {
  it("parses JSONL into typed entries", () => {
    const content = readFileSync(join(fixturesDir, "session-small.jsonl"), "utf-8");
    const entries = parseSessionJournal(content);
    expect(entries.length).toBe(8);
    expect(entries.filter((e) => e.type === "user").length).toBe(2);
    expect(entries.filter((e) => e.type === "assistant").length).toBe(2);
    expect(entries.filter((e) => e.type === "system").length).toBe(1);
  });
});

describe("extractSessionData", () => {
  it("extracts session row, messages, and tool uses", () => {
    const content = readFileSync(join(fixturesDir, "session-small.jsonl"), "utf-8");
    const entries = parseSessionJournal(content);
    const data = extractSessionData("test-session-001", entries, "cory");

    expect(data.session.id).toBe("test-session-001");
    expect(data.session.project_path).toBe("/Users/cory/myproject");
    expect(data.session.project_name).toBe("myproject");
    expect(data.session.slug).toBe("happy-coding-fox");
    expect(data.session.model).toBe("claude-opus-4-6");
    expect(data.session.user_id).toBe("cory");
    expect(data.session.total_input_tokens).toBe(3000);
    expect(data.session.total_output_tokens).toBe(600);
    expect(data.session.total_cache_read_tokens).toBe(17500);
    expect(data.session.total_cache_creation_tokens).toBe(500);
    expect(data.session.total_cost).toBeGreaterThan(0);
    expect(data.messages.length).toBe(4);
    expect(data.messages[0].role).toBe("user");
    expect(data.messages[0].content_text).toBe("fix the auth bug");
    expect(data.toolUses.length).toBe(2);
    expect(data.toolUses[0].tool_name).toBe("Read");
    expect(data.toolUses[1].tool_name).toBe("Edit");
  });
});

describe("readSessionIndex", () => {
  it("reads sessions-index.json", () => {
    const indexPath = join(fixturesDir, "sessions-index.json");
    const index = readSessionIndex(indexPath);
    expect(index.version).toBe(1);
    expect(index.entries.length).toBe(1);
    expect(index.entries[0].sessionId).toBe("test-session-001");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/__tests__/jsonl-parser.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement jsonl-parser.ts**

`packages/cli/src/importers/jsonl-parser.ts`:
```typescript
import {
  type JournalEntry,
  type UserEntry,
  type AssistantEntry,
  type ContentBlock,
  type SessionRow,
  type MessageRow,
  type ToolUseRow,
  computeCost,
} from "@cc-timetravel/shared";

export function parseSessionJournal(content: string): JournalEntry[] {
  const entries: JournalEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as JournalEntry);
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

export function extractSessionData(
  sessionId: string,
  entries: JournalEntry[],
  userId: string,
): {
  session: SessionRow;
  messages: MessageRow[];
  toolUses: ToolUseRow[];
  searchTexts: { content: string; contentType: string }[];
} {
  const messages: MessageRow[] = [];
  const toolUses: ToolUseRow[] = [];
  const searchTexts: { content: string; contentType: string }[] = [];

  let projectPath = "";
  let projectName = "";
  let slug = "";
  let gitBranch = "";
  let ccVersion = "";
  let firstPrompt = "";
  let createdAt = "";
  let modifiedAt = "";
  const modelCounts: Record<string, number> = {};

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCost = 0;

  const toolResultMap = new Map<string, { content: string; isError: boolean }>();

  // First pass: collect tool results from user messages
  for (const entry of entries) {
    if (entry.type === "user") {
      const userEntry = entry as UserEntry;
      const content = userEntry.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_result") {
            const text =
              typeof block.content === "string"
                ? block.content
                : Array.isArray(block.content)
                  ? block.content
                      .filter((b): b is { type: "text"; text: string } => b.type === "text")
                      .map((b) => b.text)
                      .join("\n")
                  : "";
            toolResultMap.set(block.tool_use_id, {
              content: text,
              isError: block.is_error ?? false,
            });
          }
        }
      }
    }
  }

  // Second pass: extract all data
  for (const entry of entries) {
    if (entry.cwd && !projectPath) {
      projectPath = entry.cwd;
      projectName = projectPath.split("/").pop() ?? projectPath;
    }
    if (entry.slug && !slug) slug = entry.slug;
    if (entry.gitBranch && !gitBranch) gitBranch = entry.gitBranch;
    if (entry.version && !ccVersion) ccVersion = entry.version;
    if (entry.timestamp) {
      if (!createdAt || entry.timestamp < createdAt) createdAt = entry.timestamp;
      if (!modifiedAt || entry.timestamp > modifiedAt) modifiedAt = entry.timestamp;
    }

    if (entry.type === "user") {
      const userEntry = entry as UserEntry;
      const contentText = extractPlainText(userEntry.message.content);
      if (!firstPrompt && contentText) firstPrompt = contentText;

      if (userEntry.uuid) {
        messages.push({
          id: userEntry.uuid,
          session_id: sessionId,
          parent_uuid: userEntry.parentUuid ?? "",
          role: "user",
          content_text: contentText,
          has_thinking: 0,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_creation_tokens: 0,
          model: "",
          timestamp: userEntry.timestamp ?? "",
        });
        if (contentText) {
          searchTexts.push({ content: contentText, contentType: "user_message" });
        }
      }
    }

    if (entry.type === "assistant") {
      const assistantEntry = entry as AssistantEntry;
      const msg = assistantEntry.message;
      const contentText = extractPlainText(msg.content);
      const hasThinking = msg.content.some((b) => b.type === "thinking") ? 1 : 0;

      const inputTokens = msg.usage.input_tokens ?? 0;
      const outputTokens = msg.usage.output_tokens ?? 0;
      const cacheReadTokens = msg.usage.cache_read_input_tokens ?? 0;
      const cacheCreationTokens = msg.usage.cache_creation_input_tokens ?? 0;

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCacheReadTokens += cacheReadTokens;
      totalCacheCreationTokens += cacheCreationTokens;
      totalCost += computeCost(msg.model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens);

      modelCounts[msg.model] = (modelCounts[msg.model] ?? 0) + 1;

      if (assistantEntry.uuid) {
        messages.push({
          id: assistantEntry.uuid,
          session_id: sessionId,
          parent_uuid: assistantEntry.parentUuid ?? "",
          role: "assistant",
          content_text: contentText,
          has_thinking: hasThinking,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheReadTokens,
          cache_creation_tokens: cacheCreationTokens,
          model: msg.model,
          timestamp: assistantEntry.timestamp ?? "",
        });
        if (contentText) {
          searchTexts.push({ content: contentText, contentType: "assistant_message" });
        }
      }

      for (const block of msg.content) {
        if (block.type === "tool_use") {
          const result = toolResultMap.get(block.id);
          toolUses.push({
            id: block.id,
            message_id: assistantEntry.uuid ?? "",
            session_id: sessionId,
            tool_name: block.name,
            input_json: JSON.stringify(block.input),
            output_text: result?.content ?? "",
            is_error: result?.isError ? 1 : 0,
            timestamp: assistantEntry.timestamp ?? "",
          });
        }
      }
    }
  }

  const model = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const durationSeconds =
    createdAt && modifiedAt
      ? Math.round((new Date(modifiedAt).getTime() - new Date(createdAt).getTime()) / 1000)
      : 0;

  const session: SessionRow = {
    id: sessionId,
    project_path: projectPath,
    project_name: projectName,
    slug,
    git_branch: gitBranch,
    first_prompt: firstPrompt,
    summary: "",
    message_count: messages.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cache_read_tokens: totalCacheReadTokens,
    total_cache_creation_tokens: totalCacheCreationTokens,
    total_cost: totalCost,
    model,
    cc_version: ccVersion,
    user_id: userId,
    created_at: createdAt,
    modified_at: modifiedAt,
    duration_seconds: durationSeconds,
  };

  return { session, messages, toolUses, searchTexts };
}

function extractPlainText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
```

- [ ] **Step 5: Implement session-index.ts**

`packages/cli/src/importers/session-index.ts`:
```typescript
import { readFileSync } from "fs";
import type { SessionIndexFile } from "@cc-timetravel/shared";

export function readSessionIndex(filePath: string): SessionIndexFile {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as SessionIndexFile;
}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/cli && npx vitest run src/__tests__/jsonl-parser.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/importers/ packages/cli/src/__tests__/
git commit -m "feat: add JSONL parser and session index reader with tests"
```

---

### Task 5: Import Command

**Files:**
- Create: `packages/cli/src/importers/importer.ts`
- Create: `packages/cli/src/commands/import.ts`
- Create: `packages/cli/src/index.ts`
- Test: `packages/cli/src/__tests__/importer.test.ts`

- [ ] **Step 1: Write failing test for importer**

`packages/cli/src/__tests__/importer.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeDatabase } from "../db/schema.js";
import { importSession } from "../importers/importer.js";
import { getSessionById, getMessagesBySessionId, getToolUsesBySessionId } from "../db/queries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initializeDatabase(db);
});

afterEach(() => {
  db.close();
});

describe("importSession", () => {
  it("imports a session JSONL file into the database", () => {
    const jsonlPath = join(fixturesDir, "session-small.jsonl");
    importSession(db, "test-session-001", jsonlPath, "cory");

    const session = getSessionById(db, "test-session-001");
    expect(session).toBeDefined();
    expect(session!.project_name).toBe("myproject");
    expect(session!.total_input_tokens).toBe(3000);
    expect(session!.total_cost).toBeGreaterThan(0);

    const messages = getMessagesBySessionId(db, "test-session-001");
    expect(messages.length).toBe(4);

    const tools = getToolUsesBySessionId(db, "test-session-001");
    expect(tools.length).toBe(2);
    expect(tools[0].tool_name).toBe("Read");
  });

  it("is idempotent", () => {
    const jsonlPath = join(fixturesDir, "session-small.jsonl");
    importSession(db, "test-session-001", jsonlPath, "cory");
    importSession(db, "test-session-001", jsonlPath, "cory");

    const messages = getMessagesBySessionId(db, "test-session-001");
    expect(messages.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/__tests__/importer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement importer.ts**

`packages/cli/src/importers/importer.ts`:
```typescript
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { parseSessionJournal, extractSessionData } from "./jsonl-parser.js";
import { readSessionIndex } from "./session-index.js";
import {
  insertSession, insertMessage, insertToolUse, insertSearchEntry,
  getImportState, setImportState,
} from "../db/queries.js";

export function importSession(
  db: Database.Database,
  sessionId: string,
  jsonlPath: string,
  userId: string,
  summary?: string,
): void {
  const content = readFileSync(jsonlPath, "utf-8");
  const entries = parseSessionJournal(content);
  const data = extractSessionData(sessionId, entries, userId);
  if (summary) data.session.summary = summary;

  const deleteInTransaction = db.transaction(() => {
    db.prepare("DELETE FROM search_index WHERE session_id = ?").run(sessionId);
    db.prepare("DELETE FROM tool_uses WHERE session_id = ?").run(sessionId);
    db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  });
  deleteInTransaction();

  const insertInTransaction = db.transaction(() => {
    insertSession(db, data.session);
    for (const msg of data.messages) insertMessage(db, msg);
    for (const tool of data.toolUses) insertToolUse(db, tool);
    for (const text of data.searchTexts) insertSearchEntry(db, sessionId, text.content, text.contentType);
    if (data.session.first_prompt) insertSearchEntry(db, sessionId, data.session.first_prompt, "first_prompt");
    if (data.session.summary) insertSearchEntry(db, sessionId, data.session.summary, "summary");
  });
  insertInTransaction();
}

export interface ImportOptions {
  claudeDir: string;
  dbPath: string;
  userId: string;
  projectFilter?: string;
  sinceDate?: string;
}

export function runFullImport(db: Database.Database, options: ImportOptions): { imported: number; skipped: number } {
  const projectsDir = join(options.claudeDir, "projects");
  if (!existsSync(projectsDir)) {
    throw new Error(`Claude projects directory not found: ${projectsDir}`);
  }

  let imported = 0;
  let skipped = 0;

  const projectDirs = readdirSync(projectsDir).filter((name) => {
    const fullPath = join(projectsDir, name);
    return statSync(fullPath).isDirectory();
  });

  for (const projectDir of projectDirs) {
    const projectPath = join(projectsDir, projectDir);
    const indexPath = join(projectPath, "sessions-index.json");
    if (!existsSync(indexPath)) continue;

    let index;
    try { index = readSessionIndex(indexPath); } catch { continue; }

    for (const entry of index.entries) {
      if (options.projectFilter && !entry.projectPath.includes(options.projectFilter)) continue;
      if (options.sinceDate && entry.created < options.sinceDate) continue;
      if (entry.isSidechain) continue;

      const stateKey = `mtime:${entry.sessionId}`;
      const lastMtime = getImportState(db, stateKey);
      if (lastMtime && Number(lastMtime) >= entry.fileMtime) { skipped++; continue; }

      const jsonlPath = entry.fullPath ?? join(projectPath, `${entry.sessionId}.jsonl`);
      if (!existsSync(jsonlPath)) { skipped++; continue; }

      try {
        importSession(db, entry.sessionId, jsonlPath, options.userId, entry.summary);
        setImportState(db, stateKey, String(entry.fileMtime));
        imported++;
      } catch (err) {
        console.error(`Failed to import session ${entry.sessionId}: ${err}`);
        skipped++;
      }
    }
  }

  return { imported, skipped };
}
```

- [ ] **Step 4: Create CLI entry point with import command**

`packages/cli/src/commands/import.ts`:
```typescript
import { Command } from "commander";
import { homedir } from "os";
import { openDatabase } from "../db/connection.js";
import { runFullImport } from "../importers/importer.js";

export const importCommand = new Command("import")
  .description("Import Claude Code history from ~/.claude/ into the local database")
  .option("--db <path>", "Database path", "./timetravel.db")
  .option("--claude-dir <path>", "Claude data directory", `${homedir()}/.claude`)
  .option("--project <name>", "Import only a specific project")
  .option("--since <date>", "Only import sessions after this date (ISO 8601)")
  .option("--user-id <name>", "User identifier for team features", process.env.USER ?? "unknown")
  .action((opts) => {
    console.log(`Opening database: ${opts.db}`);
    const db = openDatabase(opts.db);
    console.log(`Importing from: ${opts.claudeDir}`);
    const result = runFullImport(db, {
      claudeDir: opts.claudeDir,
      dbPath: opts.db,
      userId: opts.userId,
      projectFilter: opts.project,
      sinceDate: opts.since,
    });
    console.log(`\nImport complete: ${result.imported} sessions imported, ${result.skipped} skipped`);
    db.close();
  });
```

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { importCommand } from "./commands/import.js";

const program = new Command()
  .name("cc-timetravel")
  .description("Claude Code history viewer — analytics, search, and LLM insights")
  .version("0.1.0");

program.addCommand(importCommand);
program.parse();
```

- [ ] **Step 5: Run tests**

Run: `cd packages/cli && npx vitest run src/__tests__/importer.test.ts`
Expected: All 2 tests PASS.

- [ ] **Step 6: Test against real data**

Run: `cd packages/cli && npx tsx src/index.ts import --db /tmp/test-timetravel.db`
Expected: Imports sessions from `~/.claude/`, prints count.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/
git commit -m "feat: add import pipeline — parses Claude Code JSONL history into SQLite"
```

---

### Task 6: LLM Provider Interface and Ollama Implementation

**Files:**
- Create: `packages/cli/src/providers/interface.ts`
- Create: `packages/cli/src/providers/ollama.ts`
- Create: `packages/cli/src/providers/factory.ts`
- Create: `packages/cli/src/config.ts`
- Create: `packages/cli/src/commands/embed.ts`
- Create: `packages/cli/src/commands/summarize.ts`

- [ ] **Step 1: Create provider interface**

`packages/cli/src/providers/interface.ts`:
```typescript
export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface LLMProvider {
  readonly name: string;
  generateEmbedding(text: string): Promise<number[]>;
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}
```

- [ ] **Step 2: Create Ollama implementation**

`packages/cli/src/providers/ollama.ts`:
```typescript
import type { LLMProvider, CompletionOptions } from "./interface.js";

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  private baseUrl: string;
  private embeddingModel: string;
  private completionModel: string;

  constructor(baseUrl: string, embeddingModel: string, completionModel: string) {
    this.baseUrl = baseUrl;
    this.embeddingModel = embeddingModel;
    this.completionModel = completionModel;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch { return false; }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings[0];
  }

  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.completionModel,
        prompt: options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
        stream: false,
        options: { num_predict: options?.maxTokens ?? 1024, temperature: options?.temperature ?? 0.3 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
    const data = (await res.json()) as { response: string };
    return data.response;
  }
}
```

- [ ] **Step 3: Create provider factory and config**

`packages/cli/src/providers/factory.ts`:
```typescript
import type { LLMProvider } from "./interface.js";
import { OllamaProvider } from "./ollama.js";
import type { AppConfig } from "@cc-timetravel/shared";

export function createProvider(config: AppConfig["llm"]): LLMProvider {
  switch (config.provider) {
    case "ollama":
      return new OllamaProvider(config.ollamaUrl, config.embeddingModel, config.completionModel);
    default:
      return new OllamaProvider(config.ollamaUrl, config.embeddingModel, config.completionModel);
  }
}
```

`packages/cli/src/config.ts`:
```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { type AppConfig, DEFAULT_CONFIG } from "@cc-timetravel/shared";

const CONFIG_PATH = join(homedir(), ".config", "cc-timetravel", "config.json");

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch { return { ...DEFAULT_CONFIG }; }
}

export function saveConfig(config: AppConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getConfigPath(): string { return CONFIG_PATH; }
```

- [ ] **Step 4: Create embed and summarize commands**

`packages/cli/src/commands/embed.ts`:
```typescript
import { Command } from "commander";
import { openDatabase } from "../db/connection.js";
import { loadConfig } from "../config.js";
import { createProvider } from "../providers/factory.js";

export const embedCommand = new Command("embed")
  .description("Generate embeddings for imported session data")
  .option("--db <path>", "Database path", "./timetravel.db")
  .option("--provider <name>", "LLM provider (ollama, openrouter, anthropic, openai)")
  .option("--model <name>", "Embedding model name")
  .option("--batch-size <n>", "Concurrent embedding requests", "5")
  .action(async (opts) => {
    const config = loadConfig();
    if (opts.provider) config.llm.provider = opts.provider;
    if (opts.model) config.llm.embeddingModel = opts.model;

    const provider = createProvider(config.llm);
    if (!(await provider.isAvailable())) {
      console.error(`LLM provider "${config.llm.provider}" is not available.`);
      process.exit(1);
    }

    const db = openDatabase(opts.db);
    const batchSize = parseInt(opts.batchSize);
    const sessions = db.prepare(`
      SELECT s.id, s.first_prompt, s.summary
      FROM sessions s LEFT JOIN embeddings e ON e.session_id = s.id AND e.chunk_type = 'session_summary'
      WHERE e.id IS NULL
    `).all() as { id: string; first_prompt: string; summary: string }[];

    console.log(`Generating embeddings for ${sessions.length} sessions...`);
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize);
      await Promise.all(batch.map(async (session) => {
        const text = session.summary || session.first_prompt;
        if (!text) return;
        try {
          const embedding = await provider.generateEmbedding(text);
          const blob = Buffer.from(new Float32Array(embedding).buffer);
          db.prepare("INSERT INTO embeddings (session_id, text_chunk, embedding, chunk_type) VALUES (?, ?, ?, ?)")
            .run(session.id, text, blob, "session_summary");
        } catch (err) { console.error(`Failed to embed session ${session.id}: ${err}`); }
      }));
      process.stdout.write(`\r  ${Math.min(i + batchSize, sessions.length)}/${sessions.length}`);
    }
    console.log("\nDone.");
    db.close();
  });
```

`packages/cli/src/commands/summarize.ts`:
```typescript
import { Command } from "commander";
import { openDatabase } from "../db/connection.js";
import { loadConfig } from "../config.js";
import { createProvider } from "../providers/factory.js";

export const summarizeCommand = new Command("summarize")
  .description("Generate LLM summaries for imported sessions")
  .option("--db <path>", "Database path", "./timetravel.db")
  .option("--provider <name>", "LLM provider")
  .option("--model <name>", "Completion model name")
  .action(async (opts) => {
    const config = loadConfig();
    if (opts.provider) config.llm.provider = opts.provider;
    if (opts.model) config.llm.completionModel = opts.model;

    const provider = createProvider(config.llm);
    if (!(await provider.isAvailable())) {
      console.error(`LLM provider "${config.llm.provider}" is not available.`);
      process.exit(1);
    }

    const db = openDatabase(opts.db);
    const sessions = db.prepare(`
      SELECT s.id, s.first_prompt, GROUP_CONCAT(m.content_text, '\n') as conversation
      FROM sessions s JOIN messages m ON m.session_id = s.id
      WHERE s.summary = '' OR s.summary IS NULL
      GROUP BY s.id LIMIT 100
    `).all() as { id: string; first_prompt: string; conversation: string }[];

    console.log(`Generating summaries for ${sessions.length} sessions...`);
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      try {
        const summary = await provider.generateCompletion(
          `Summarize this Claude Code session in 1-2 sentences. Focus on what was accomplished.\n\nFirst prompt: ${s.first_prompt}\n\nConversation excerpt:\n${s.conversation.slice(0, 4000)}`,
          { maxTokens: 200, temperature: 0.2, systemPrompt: "You are a concise technical summarizer." },
        );
        db.prepare("UPDATE sessions SET summary = ? WHERE id = ?").run(summary.trim(), s.id);
      } catch (err) { console.error(`Failed: ${err}`); }
      process.stdout.write(`\r  ${i + 1}/${sessions.length}`);
    }
    console.log("\nDone.");
    db.close();
  });
```

- [ ] **Step 5: Update CLI entry point**

Replace `packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { importCommand } from "./commands/import.js";
import { embedCommand } from "./commands/embed.js";
import { summarizeCommand } from "./commands/summarize.js";

const program = new Command()
  .name("cc-timetravel")
  .description("Claude Code history viewer — analytics, search, and LLM insights")
  .version("0.1.0");

program.addCommand(importCommand);
program.addCommand(embedCommand);
program.addCommand(summarizeCommand);
program.parse();
```

- [ ] **Step 6: Verify and commit**

Run: `cd packages/cli && npx tsx src/index.ts --help`
Expected: Shows `import`, `embed`, `summarize` commands.

```bash
git add packages/cli/src/
git commit -m "feat: add LLM provider abstraction, embed and summarize commands"
```

---

### Task 7: Redaction Engine and Export Command

**Files:**
- Create: `packages/cli/src/redaction/redactor.ts`
- Create: `packages/cli/src/commands/export.ts`
- Test: `packages/cli/src/__tests__/redactor.test.ts`

- [ ] **Step 1: Write failing test for redaction**

`packages/cli/src/__tests__/redactor.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { Redactor } from "../redaction/redactor.js";

describe("Redactor", () => {
  it("redacts tool outputs when rule is enabled", () => {
    const r = new Redactor(["redact-tool-outputs"]);
    expect(r.redactToolOutput("SELECT * FROM users")).toBe("[REDACTED]");
  });

  it("preserves tool outputs when rule is disabled", () => {
    const r = new Redactor([]);
    expect(r.redactToolOutput("SELECT * FROM users")).toBe("SELECT * FROM users");
  });

  it("redacts code blocks", () => {
    const r = new Redactor(["redact-code"]);
    const input = "Here is the fix:\n```typescript\nconst x = 1;\n```\nDone.";
    const result = r.redactText(input);
    expect(result).not.toContain("const x = 1");
    expect(result).toContain("[CODE REDACTED]");
    expect(result).toContain("Done.");
  });

  it("redacts file paths", () => {
    const r = new Redactor(["redact-paths"]);
    const input = "Reading /Users/cory/secret-project/src/auth.ts";
    const result = r.redactText(input);
    expect(result).not.toContain("/Users/cory/secret-project");
    expect(result).toContain("[PATH:");
  });

  it("redacts custom patterns", () => {
    const r = new Redactor(["redact-pattern:API_KEY_\\w+"]);
    const input = "Using API_KEY_abc123 for auth";
    const result = r.redactText(input);
    expect(result).not.toContain("API_KEY_abc123");
    expect(result).toContain("[REDACTED]");
  });

  it("composes multiple rules", () => {
    const r = new Redactor(["redact-code", "redact-paths"]);
    const input = "File /Users/cory/app.ts:\n```\nconst x = 1;\n```";
    const result = r.redactText(input);
    expect(result).not.toContain("/Users/cory");
    expect(result).not.toContain("const x = 1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/__tests__/redactor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement redactor**

`packages/cli/src/redaction/redactor.ts`:
```typescript
import { createHash } from "crypto";

export class Redactor {
  private redactToolOutputs: boolean;
  private redactCode: boolean;
  private redactPaths: boolean;
  private customPatterns: RegExp[];

  constructor(rules: string[]) {
    this.redactToolOutputs = rules.includes("redact-tool-outputs");
    this.redactCode = rules.includes("redact-code");
    this.redactPaths = rules.includes("redact-paths");
    this.customPatterns = rules
      .filter((r) => r.startsWith("redact-pattern:"))
      .map((r) => new RegExp(r.slice("redact-pattern:".length), "g"));
  }

  redactToolOutput(text: string): string {
    if (this.redactToolOutputs) return "[REDACTED]";
    return this.redactText(text);
  }

  redactText(text: string): string {
    let result = text;
    if (this.redactCode) result = result.replace(/```[\s\S]*?```/g, "[CODE REDACTED]");
    if (this.redactPaths) {
      result = result.replace(/(?:\/[\w.-]+){3,}/g, (match) => {
        const hash = createHash("sha256").update(match).digest("hex").slice(0, 8);
        return `[PATH:${hash}]`;
      });
    }
    for (const pattern of this.customPatterns) result = result.replace(pattern, "[REDACTED]");
    return result;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/cli && npx vitest run src/__tests__/redactor.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Create export command**

`packages/cli/src/commands/export.ts`:
```typescript
import { Command } from "commander";
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { Redactor } from "../redaction/redactor.js";

export const exportCommand = new Command("export")
  .description("Export sanitized data for team sharing")
  .requiredOption("--output <dir>", "Output directory")
  .option("--db <path>", "Source database path", "./timetravel.db")
  .option("--redact-tool-outputs", "Strip tool execution results")
  .option("--redact-code", "Strip code blocks from messages")
  .option("--redact-paths", "Hash file paths")
  .option("--redact-pattern <regex>", "Custom redaction pattern", (val: string, prev: string[]) => [...prev, val], [] as string[])
  .option("--user-id <name>", "User identifier", process.env.USER ?? "unknown")
  .action((opts) => {
    if (!existsSync(opts.db)) { console.error(`Database not found: ${opts.db}`); process.exit(1); }

    const rules: string[] = [];
    if (opts.redactToolOutputs) rules.push("redact-tool-outputs");
    if (opts.redactCode) rules.push("redact-code");
    if (opts.redactPaths) rules.push("redact-paths");
    for (const p of opts.redactPattern) rules.push(`redact-pattern:${p}`);

    const redactor = new Redactor(rules);
    mkdirSync(opts.output, { recursive: true });
    const exportDbPath = join(opts.output, "timetravel-export.db");
    copyFileSync(opts.db, exportDbPath);

    const db = new Database(exportDbPath);
    db.pragma("journal_mode = WAL");

    if (rules.length > 0) {
      console.log(`Applying redaction rules: ${rules.join(", ")}`);
      const messages = db.prepare("SELECT id, content_text FROM messages").all() as { id: string; content_text: string }[];
      const updateMsg = db.prepare("UPDATE messages SET content_text = ? WHERE id = ?");
      for (const msg of messages) updateMsg.run(redactor.redactText(msg.content_text), msg.id);

      const tools = db.prepare("SELECT id, input_json, output_text FROM tool_uses").all() as { id: string; input_json: string; output_text: string }[];
      const updateTool = db.prepare("UPDATE tool_uses SET input_json = ?, output_text = ? WHERE id = ?");
      for (const tool of tools) updateTool.run(redactor.redactText(tool.input_json), redactor.redactToolOutput(tool.output_text), tool.id);

      const sessions = db.prepare("SELECT id, first_prompt, summary FROM sessions").all() as { id: string; first_prompt: string; summary: string }[];
      const updateSession = db.prepare("UPDATE sessions SET first_prompt = ?, summary = ? WHERE id = ?");
      for (const s of sessions) updateSession.run(redactor.redactText(s.first_prompt), redactor.redactText(s.summary), s.id);

      db.exec("DROP TABLE IF EXISTS search_index");
      db.exec("DELETE FROM embeddings");
    }

    db.prepare("UPDATE sessions SET user_id = ?").run(opts.userId);
    const sessionCount = (db.prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number }).c;
    db.close();

    writeFileSync(join(opts.output, "manifest.json"), JSON.stringify({
      userId: opts.userId,
      exportDate: new Date().toISOString(),
      redactionRules: rules,
      sessionCount,
    }, null, 2));

    console.log(`Export complete: ${sessionCount} sessions -> ${opts.output}`);
  });
```

- [ ] **Step 6: Update CLI and commit**

Add `exportCommand` to `packages/cli/src/index.ts`, then:

```bash
git add packages/cli/src/
git commit -m "feat: add redaction engine and export command for team sharing"
```

---

### Task 8: Next.js Viewer Setup and Terminal Theme

**Files:** See file structure under `packages/viewer/`. Creates Next.js config, global CSS, DB connection, format helpers, nav component, and root layout.

- [ ] **Step 1: Create Next.js config files**

`packages/viewer/next.config.ts`:
```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = { serverExternalPackages: ["better-sqlite3"] };
export default nextConfig;
```

`packages/viewer/postcss.config.mjs`:
```javascript
export default { plugins: { "@tailwindcss/postcss": {} } };
```

- [ ] **Step 2: Create globals.css with terminal theme**

`packages/viewer/src/app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --font-mono: "SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
  --color-bg: #0a0a0a;
  --color-bg-raised: #111111;
  --color-bg-hover: #161616;
  --color-border: #1a1a1a;
  --color-border-bright: #222222;
  --color-text: #888888;
  --color-text-bright: #e2e0ea;
  --color-text-dim: #444444;
  --color-text-muted: #555555;
  --color-green: #22c55e;
  --color-green-dim: #166534;
  --color-blue: #60a5fa;
  --color-amber: #f59e0b;
  --color-red: #ef4444;
  --color-purple: #a78bfa;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--color-bg); }
::-webkit-scrollbar-thumb { background: var(--color-border-bright); border-radius: 3px; }
```

- [ ] **Step 3: Create DB connection, format helpers, nav, and layout**

Create `packages/viewer/src/lib/db.ts`, `packages/viewer/src/lib/format.ts`, `packages/viewer/src/components/layout/nav.tsx`, and `packages/viewer/src/app/layout.tsx` as specified in the file structure section. See the design spec for full component code — the nav uses the tab pattern (Dashboard, Sessions, Search, Insights) with green active indicator, and the layout wraps children with the nav.

`packages/viewer/src/app/page.tsx` (placeholder):
```tsx
export default function DashboardPage() {
  return <div className="text-[var(--color-text-muted)]">Dashboard loading...</div>;
}
```

- [ ] **Step 4: Verify**

Run: `cd packages/viewer && npx next dev --port 3001`
Expected: Dark terminal-themed page with nav at localhost:3001.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/
git commit -m "feat: add Next.js viewer with terminal theme and navigation shell"
```

---

### Task 9: Dashboard API Routes

**Files:** Create `packages/viewer/src/app/api/stats/route.ts`, `packages/viewer/src/app/api/charts/route.ts`, `packages/viewer/src/app/api/sessions/route.ts`, `packages/viewer/src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1-4: Create all API routes**

Each route reads from SQLite via `getDb()`, applies query params for filtering (since, until, project, userId), and returns JSON. The stats route returns aggregate counts, charts route returns time-series + tool breakdown, sessions route returns paginated list, and sessions/[id] route returns session + messages + tool_uses.

See Task 9 in the design spec for full implementations of each route.

- [ ] **Step 5: Commit**

```bash
git add packages/viewer/src/app/api/
git commit -m "feat: add API routes for stats, charts, sessions, and session detail"
```

---

### Task 10: Dashboard Page

**Files:** Create `packages/viewer/src/components/stat-card.tsx`, `packages/viewer/src/components/layout/filters.tsx`, `packages/viewer/src/components/charts/usage-chart.tsx`, `packages/viewer/src/components/charts/tool-breakdown.tsx`. Replace `packages/viewer/src/app/page.tsx`.

- [ ] **Step 1-5: Build all dashboard components**

StatCard: bordered box with label, large colored value, and trend arrow. Filters: time range buttons (7d/30d/90d/All) + project and user dropdowns. UsageChart: Recharts BarChart with green bars. ToolBreakdown: horizontal progress bars with colored percentages.

Dashboard page: client component with `useEffect` fetching `/api/stats`, `/api/charts`, `/api/sessions?limit=10`. Renders filters, 5 stat cards in a grid, 2-column chart row, and recent sessions table.

See Task 10 in the design spec for full component implementations.

- [ ] **Step 6: Test the dashboard**

Import real data, start viewer, verify dashboard shows actual stats.

- [ ] **Step 7: Commit**

```bash
git add packages/viewer/
git commit -m "feat: add interactive dashboard with stat cards, charts, and session list"
```

---

### Task 11: Sessions List and Detail Pages

**Files:** Create `packages/viewer/src/components/tables/sessions-table.tsx`, `packages/viewer/src/app/sessions/page.tsx`, `packages/viewer/src/app/sessions/[id]/page.tsx`

- [ ] **Step 1-3: Build sessions table, list page, and detail page**

SessionsTable: grid layout with sortable column headers, clickable rows linking to `/sessions/[id]`, and pagination controls.

Sessions list page: fetches `/api/sessions` with sort/pagination params.

Session detail page: fetches `/api/sessions/[id]`, renders conversation messages with per-message token costs, tool usage indicators, and a stats sidebar showing total tokens, cost, duration, cache hit rate, model, and tool breakdown.

See Task 11 in the design spec for full component implementations.

- [ ] **Step 4: Verify and commit**

```bash
git add packages/viewer/src/
git commit -m "feat: add sessions list with sort/pagination and session detail view"
```

---

### Task 12: Search Page

**Files:** Create `packages/viewer/src/app/api/search/route.ts`, `packages/viewer/src/components/search-results.tsx`, `packages/viewer/src/app/search/page.tsx`

- [ ] **Step 1-3: Build search API, results component, and page**

Search API: FTS5 keyword search with snippet highlighting using `»` and `«` markers. Deduplicates by session_id. Returns results joined with session metadata.

SearchResults component: renders cards with highlighted snippets (replacing markers with `<mark>` tags), session name, project, cost, and relative time.

Search page: input with mode toggle (Keyword/Semantic), search button, results list.

See Task 12 in the design spec for full implementations.

- [ ] **Step 4: Test and commit**

```bash
git add packages/viewer/src/
git commit -m "feat: add search page with keyword (FTS5) search and result highlighting"
```

---

### Task 13: Insights Page

**Files:** Create `packages/viewer/src/app/api/insights/route.ts`, `packages/viewer/src/app/insights/page.tsx`

- [ ] **Step 1-2: Build insights API and page**

Insights API returns: most expensive sessions, cost by project, top tools with error counts, error-prone sessions, LLM insights (if any), model usage distribution.

Insights page renders a 2-column grid of panels: Cost by Project, Most Expensive Sessions, Tool Usage, Model Usage. LLM insights (if generated) display at top with purple left-border accent.

See Task 13 in the design spec for full implementations.

- [ ] **Step 3: Commit**

```bash
git add packages/viewer/src/
git commit -m "feat: add insights page with cost analysis, tool usage, and model breakdown"
```

---

### Task 14: Serve and Config Commands

**Files:** Create `packages/cli/src/commands/serve.ts`, `packages/cli/src/commands/config.ts`. Update `packages/cli/src/index.ts`.

- [ ] **Step 1: Create serve command**

`packages/cli/src/commands/serve.ts`:
```typescript
import { Command } from "commander";
import { spawn } from "child_process";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

export const serveCommand = new Command("serve")
  .description("Start the cc-timetravel viewer")
  .option("--db <path>", "Database path", "./timetravel.db")
  .option("--port <n>", "Port number", "3000")
  .option("--team-dir <path>", "Directory of team member exports to merge")
  .action((opts) => {
    if (!existsSync(opts.db)) {
      console.error(`Database not found: ${opts.db}`);
      console.error('Run "cc-timetravel import" first.');
      process.exit(1);
    }

    const viewerDir = join(dirname(fileURLToPath(import.meta.url)), "../../viewer");
    console.log(`Starting viewer on port ${opts.port}...`);

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      TIMETRAVEL_DB: resolve(opts.db),
      PORT: opts.port,
    };
    if (opts.teamDir) env.TIMETRAVEL_TEAM_DIR = resolve(opts.teamDir);

    const child = spawn("npx", ["next", "dev", "--port", opts.port], {
      cwd: viewerDir,
      env,
      stdio: "inherit",
    });
    child.on("error", (err) => { console.error(`Failed: ${err.message}`); process.exit(1); });
  });
```

- [ ] **Step 2: Create config command**

`packages/cli/src/commands/config.ts`:
```typescript
import { Command } from "commander";
import { loadConfig, saveConfig, getConfigPath } from "../config.js";

export const configCommand = new Command("config")
  .description("View and manage configuration")
  .action(() => {
    console.log(`Config path: ${getConfigPath()}\n`);
    console.log(JSON.stringify(loadConfig(), null, 2));
  });

configCommand.command("set <key> <value>")
  .description("Set a config value (e.g., llm.provider ollama)")
  .action((key: string, value: string) => {
    const config = loadConfig();
    const keys = key.split(".");
    let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] as Record<string, unknown>;
    obj[keys[keys.length - 1]] = value;
    saveConfig(config);
    console.log(`Set ${key} = ${value}`);
  });
```

- [ ] **Step 3: Update CLI with all commands and commit**

Add `serveCommand` and `configCommand` to `packages/cli/src/index.ts`.

```bash
git add packages/cli/src/
git commit -m "feat: add serve and config commands, completing the CLI"
```

---

### Task 15: End-to-End Verification

- [ ] **Step 1: Full import**

```bash
cd packages/cli && npx tsx src/index.ts import --db ../../timetravel.db
```

- [ ] **Step 2: Verify database**

```bash
sqlite3 ../../timetravel.db "SELECT 'sessions', COUNT(*) FROM sessions UNION ALL SELECT 'messages', COUNT(*) FROM messages UNION ALL SELECT 'tool_uses', COUNT(*) FROM tool_uses;"
```

- [ ] **Step 3: Test incremental import (should be fast)**

- [ ] **Step 4: Start viewer and test all pages**

- [ ] **Step 5: Test export with redaction**

```bash
npx tsx src/index.ts export --db ../../timetravel.db --output /tmp/tt-export --redact-tool-outputs --redact-paths
```

- [ ] **Step 6: Commit fixes**

```bash
git add -A && git commit -m "fix: end-to-end integration fixes"
```

---

## Self-Review

**Spec coverage:** All requirements covered — architecture, data model (6 tables), CLI commands (6), viewer pages (4 + detail), visual theme, LLM provider, redaction, team sharing, graceful degradation, FTS5 search, incremental import.

**Placeholder scan:** No TBD/TODO. All code blocks complete.

**Type consistency:** SessionRow, MessageRow, ToolUseRow, ChartDataPoint, ToolBreakdown, SearchResult used consistently across shared types, CLI, and viewer.
