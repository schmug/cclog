# cc-timetravel: Claude Code History Viewer

## Context

Claude Code stores rich conversation history in `~/.claude/` — 3,647+ session files across 130+ projects with full token usage, tool calls, timestamps, git context, and parent-child message threading. This data is valuable for understanding how teams use Claude Code, tracking costs, finding past solutions, and identifying workflow patterns. But it's locked in raw JSONL files with no way to search, analyze, or share it.

**cc-timetravel** is a CLI + web viewer that unlocks this data for individuals and teams.

## Architecture

**Two components:**

1. **CLI (`cc-timetravel`)** — Imports `~/.claude/` data into a SQLite database, generates embeddings and LLM summaries, and exports sanitized data for team sharing via git.
2. **Next.js Viewer** — Reads the SQLite database and presents an interactive, searchable, analytics-rich dashboard with a terminal/hacker aesthetic.

```
~/.claude/ (JSONL)
    │
    ▼
cc-timetravel import ──► SQLite + sqlite-vec (local)
    │                         │
    ▼                         ▼
cc-timetravel export    cc-timetravel serve ──► Next.js viewer
    │                                              (localhost:3000)
    ▼
team-repo/members/user/ (git, redacted)
    │
    ▼
cc-timetravel serve --team-dir ──► merged team views
```

## Tech Stack

- **Frontend:** Next.js + React (App Router)
- **Database:** SQLite via better-sqlite3, sqlite-vec for vector search, FTS5 for full-text search
- **LLM:** Pluggable provider (Ollama default, OpenRouter, Anthropic, OpenAI)
- **Styling:** Tailwind CSS with custom terminal/hacker theme
- **Charts:** Recharts
- **Tables:** TanStack Table
- **CLI:** Commander.js
- **Monorepo:** Turborepo with shared packages

## Visual Direction

**Terminal/hacker aesthetic:**
- Dark background (#0a0a0a)
- Monospace typography (SF Mono / Fira Code / Consolas)
- Green (#22c55e) as primary accent — echoing terminal
- Blue (#60a5fa) for links and interactive elements
- Amber (#f59e0b) for token counts
- Red (#ef4444) for costs
- Data-dense, information-rich layouts
- Minimal whitespace, maximum signal

## Data Model

### Source Data (read from ~/.claude/)

**`~/.claude/history.jsonl`** — Global history index (3,853 entries)
- Fields: `display`, `timestamp`, `project`, `sessionId`

**`~/.claude/projects/{hash}/sessions-index.json`** — Per-project session index
- Fields: `sessionId`, `firstPrompt`, `summary`, `messageCount`, `created`, `modified`, `gitBranch`, `projectPath`

**`~/.claude/projects/{hash}/{uuid}.jsonl`** — Full session data
- Entry types: `user`, `assistant`, `progress`, `system`, `permission-mode`, `file-history-snapshot`, `attachment`, `queue-operation`, `last-prompt`
- Key fields on assistant entries: `message.usage.{input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}`, `message.model`, `message.content[].type` (text, tool_use, thinking)

### SQLite Schema

**`sessions`**
| Column | Type | Source |
|--------|------|--------|
| id | TEXT PK | sessionId UUID |
| project_path | TEXT | cwd from first entry |
| project_name | TEXT | last segment of project_path |
| slug | TEXT | slug field |
| git_branch | TEXT | gitBranch field |
| first_prompt | TEXT | first user message text |
| summary | TEXT | sessions-index.json summary OR LLM-generated |
| message_count | INTEGER | count of user + assistant entries |
| total_input_tokens | INTEGER | sum across all assistant entries |
| total_output_tokens | INTEGER | sum across all assistant entries |
| total_cache_read_tokens | INTEGER | sum of cache_read_input_tokens |
| total_cache_creation_tokens | INTEGER | sum of cache_creation_input_tokens |
| total_cost | REAL | computed from token counts × model pricing |
| model | TEXT | most-used model in session |
| cc_version | TEXT | version field |
| user_id | TEXT | for team aggregation |
| created_at | TEXT | ISO 8601 |
| modified_at | TEXT | ISO 8601 |
| duration_seconds | INTEGER | modified_at - created_at |

**`messages`**
| Column | Type | Source |
|--------|------|--------|
| id | TEXT PK | uuid |
| session_id | TEXT FK | sessionId |
| parent_uuid | TEXT | parentUuid |
| role | TEXT | user/assistant |
| content_text | TEXT | extracted plaintext from content array |
| has_thinking | BOOLEAN | whether content includes thinking blocks |
| input_tokens | INTEGER | usage.input_tokens |
| output_tokens | INTEGER | usage.output_tokens |
| cache_read_tokens | INTEGER | usage.cache_read_input_tokens |
| cache_creation_tokens | INTEGER | usage.cache_creation_input_tokens |
| model | TEXT | message.model |
| timestamp | TEXT | ISO 8601 |

**`tool_uses`**
| Column | Type | Source |
|--------|------|--------|
| id | TEXT PK | tool_use.id |
| message_id | TEXT FK | parent message uuid |
| session_id | TEXT FK | sessionId |
| tool_name | TEXT | tool_use.name |
| input_json | TEXT | JSON stringified tool_use.input |
| output_text | TEXT | corresponding tool_result content |
| is_error | BOOLEAN | tool_result.is_error |
| timestamp | TEXT | parent message timestamp |

**`embeddings`**
| Column | Type | Source |
|--------|------|--------|
| id | INTEGER PK | auto |
| session_id | TEXT FK | session reference |
| message_id | TEXT FK | message reference (nullable) |
| text_chunk | TEXT | the text that was embedded |
| embedding | FLOAT[N] | sqlite-vec vector |
| chunk_type | TEXT | session_summary / message / tool_output |

**`insights`**
| Column | Type | Source |
|--------|------|--------|
| id | INTEGER PK | auto |
| session_id | TEXT FK | nullable (can be cross-session) |
| insight_type | TEXT | summary / pattern / recommendation |
| content | TEXT | LLM-generated text |
| created_at | TEXT | ISO 8601 |

**`import_state`**
| Column | Type | Purpose |
|--------|------|---------|
| key | TEXT PK | e.g. "last_import_at", per-session mtimes |
| value | TEXT | timestamp or JSON |

**Indexes:**
- `sessions`: project_path, created_at, user_id
- `messages`: session_id, role, timestamp
- `tool_uses`: session_id, tool_name
- FTS5 virtual table on `messages.content_text` + `sessions.first_prompt` + `sessions.summary`

## CLI Commands

### `cc-timetravel import`

Reads `~/.claude/` and populates the local SQLite database. Incremental — tracks last-modified timestamps per session file and only re-imports changed sessions.

Flags:
- `--db <path>` — Database path (default: `./timetravel.db`)
- `--claude-dir <path>` — Override `~/.claude/` location
- `--project <name>` — Import only a specific project
- `--since <date>` — Only sessions after this date
- `--skip-embeddings` — Skip embedding generation
- `--skip-summaries` — Skip LLM summary generation

### `cc-timetravel embed`

Generate or update embeddings for imported data.

Flags:
- `--provider ollama|openrouter|anthropic|openai`
- `--model <name>` — Embedding model (default: `nomic-embed-text`)
- `--batch-size <n>` — Concurrent requests

### `cc-timetravel summarize`

Generate LLM summaries and pattern insights.

Flags:
- `--provider` / `--model` — LLM provider config
- `--type summaries|patterns|all`

### `cc-timetravel export`

Export sanitized data for team sharing.

Flags:
- `--output <dir>` — Output directory
- `--redact-tool-outputs` — Strip tool execution results
- `--redact-code` — Strip code blocks
- `--redact-paths` — Hash file paths
- `--redact-pattern <regex>` — Custom redaction
- `--keep-analytics` — Always preserve token/cost/timing data (on by default)

Outputs:
- `timetravel-export.db` — Sanitized SQLite database
- `manifest.json` — Metadata (username, export date, redaction rules, session count)

### `cc-timetravel serve`

Start the Next.js viewer.

Flags:
- `--db <path>` — Database path (default: `./timetravel.db`)
- `--port <n>` — Port (default: 3000)
- `--team-dir <path>` — Directory of team member exports to merge

### `cc-timetravel config`

Interactive configuration for LLM provider, default redaction rules, etc.

## Viewer Pages

### Dashboard (landing page)

- **Top nav:** Logo + tab navigation (Dashboard, Sessions, Search, Insights) + global search + user menu
- **Filters:** Time range (7d/30d/90d/All) + project dropdown + team member dropdown
- **Stat cards (5):** Sessions, Messages, Total Tokens, Total Cost, Avg Session Duration — each with trend vs. previous period
- **Usage chart:** Sessions/tokens/cost over time (bar chart, selectable metric)
- **Tool breakdown:** Horizontal bar chart of tool usage distribution
- **Recent sessions table:** Session name, project, message count, tokens, cost, relative time — clickable rows

### Sessions

- **Sortable/filterable table** of all sessions with columns: name, project, messages, tokens, cost, model, date, duration
- **Filters:** Project, model, date range, cost range, message count range
- **Click into session** → Session Detail view:
  - Summary (LLM-generated or first prompt)
  - Message-by-message conversation view with token cost per message
  - Tool usage timeline (which tools, when, success/error)
  - Session stats sidebar: total tokens, cost, duration, model breakdown, cache hit rate

### Search

- **Search bar** with mode toggle: Keyword (FTS5) | Semantic (embeddings)
- **Keyword search:** Fast full-text search across message content, session summaries, first prompts
- **Semantic search:** Natural language queries → embedding similarity search. "Sessions where we debugged authentication issues" or "How did we set up the CI pipeline?"
- **Results:** Session cards with matching snippet highlighted, relevance score, session metadata
- **Faceted filters:** Project, date range, role (user/assistant), tool used

### Insights

- **Session summaries:** Auto-generated natural language summaries of what was accomplished
- **Pattern detection:** Recurring workflows, common prompt strategies, frequently used tool chains
- **Failure analysis:** Common error patterns, tool failures, sessions with high retry counts
- **Cost insights:** Cost optimization suggestions, most expensive sessions/projects, cost-per-outcome estimates
- **Team comparisons** (when team data available): Usage patterns across members, tool preferences, cost distribution

## Team Sharing Model

### Export Flow

```
1. cc-timetravel export --output ./team-repo/members/cory/
2. cd team-repo && git add . && git commit && git push
3. Other members pull and run: cc-timetravel serve --team-dir ./team-repo/members/
```

### Redaction

Redaction is **configurable and composable**. Default rules are set via `cc-timetravel config`, overridable per export.

| Rule | What it does |
|------|-------------|
| `--redact-tool-outputs` | Replaces tool result content with `[REDACTED]`, preserves tool name + structure |
| `--redact-code` | Strips fenced code blocks from messages |
| `--redact-paths` | Replaces absolute file paths with deterministic hashes (preserves structure analysis without exposing paths) |
| `--redact-pattern <regex>` | Custom regex — matched text replaced with `[REDACTED]` |

Analytics data (tokens, costs, timing, tool names, session metadata) is always preserved.

### Team Repo Structure

```
team-analytics/
├── members/
│   ├── cory/
│   │   ├── timetravel-export.db
│   │   └── manifest.json
│   ├── alex/
│   │   └── ...
│   └── jordan/
│       └── ...
└── .gitattributes  (Git LFS for .db files)
```

### Merged Viewer

`cc-timetravel serve --team-dir` attaches all member databases and presents unified views. The viewer queries across all attached DBs, using `user_id` from manifests to attribute data. Team-level aggregations (total cost, session counts, tool preferences) are computed at query time.

## LLM Provider Abstraction

### Interface

```typescript
interface LLMProvider {
  generateEmbedding(text: string): Promise<number[]>
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>
}

interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}
```

### Implementations

| Provider | Embedding Model | Completion Model | Cost |
|----------|----------------|-----------------|------|
| **Ollama** (default) | nomic-embed-text | llama3.2 | Free |
| OpenRouter | varies | varies | Pay-per-use |
| Anthropic | — (use OpenAI for embeddings) | claude-sonnet-4-20250514 | Pay-per-use |
| OpenAI | text-embedding-3-small | gpt-4o-mini | Pay-per-use |

### Configuration

Stored in `~/.config/cc-timetravel/config.json`:

```json
{
  "llm": {
    "provider": "ollama",
    "embeddingModel": "nomic-embed-text",
    "completionModel": "llama3.2",
    "ollamaUrl": "http://localhost:11434"
  },
  "redaction": {
    "defaultRules": ["redact-tool-outputs", "redact-paths"]
  },
  "import": {
    "claudeDir": "~/.claude",
    "dbPath": "./timetravel.db"
  }
}
```

### Graceful Degradation

- **No Ollama running:** Import works, skips embeddings/summaries. Warns user.
- **No embeddings:** Semantic search unavailable, keyword search works.
- **No summaries:** Session list shows first prompt instead of summary.
- **No LLM at all:** Pure analytics mode — all token/cost/tool data still works.

## Monorepo Structure

```
cc-timetravel/
├── packages/
│   ├── cli/              # Commander.js CLI
│   │   ├── src/
│   │   │   ├── commands/     # import, export, embed, summarize, serve, config
│   │   │   ├── importers/    # JSONL parser, session-index reader
│   │   │   ├── providers/    # LLM provider implementations
│   │   │   ├── redaction/    # Redaction engine
│   │   │   └── db/           # SQLite schema, migrations, queries
│   │   └── package.json
│   ├── viewer/           # Next.js app
│   │   ├── src/
│   │   │   ├── app/          # App Router pages
│   │   │   │   ├── page.tsx          # Dashboard
│   │   │   │   ├── sessions/         # Sessions list + detail
│   │   │   │   ├── search/           # Search page
│   │   │   │   └── insights/         # Insights page
│   │   │   ├── components/   # React components
│   │   │   │   ├── charts/           # Recharts wrappers
│   │   │   │   ├── tables/           # TanStack Table wrappers
│   │   │   │   └── layout/           # Nav, filters, shell
│   │   │   ├── lib/          # API helpers, data fetching
│   │   │   └── styles/       # Tailwind theme + terminal CSS
│   │   └── package.json
│   └── shared/           # Shared types, constants, pricing tables
│       ├── src/
│       │   ├── types.ts
│       │   ├── pricing.ts    # Model → cost-per-token mapping
│       │   └── constants.ts
│       └── package.json
├── turbo.json
├── package.json
└── README.md
```

## Verification

### CLI

1. `cc-timetravel import --db test.db` — imports from real `~/.claude/`, check session counts match
2. `cc-timetravel embed --db test.db` — generates embeddings (requires Ollama running)
3. `cc-timetravel export --output /tmp/export --redact-tool-outputs --db test.db` — verify tool outputs are redacted in export DB
4. Verify incremental import: run import twice, second run should be fast (no changes)

### Viewer

1. `cc-timetravel serve --db test.db` — opens viewer at localhost:3000
2. Dashboard: verify stat cards show correct aggregates
3. Sessions: verify sortable table, click into session detail
4. Search: test keyword search, test semantic search (if embeddings exist)
5. Insights: verify summaries display (if generated)
6. Filter by project, time range — verify charts and tables update

### Team

1. Export two test databases with different user_ids
2. Serve with `--team-dir` pointing at both
3. Verify merged dashboard shows combined stats
4. Verify user filter separates data correctly
