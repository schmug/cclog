# cclog

CLI tool and web dashboard for analyzing Claude Code session history.

Import your Claude Code sessions into SQLite, explore usage analytics, run full-text search, generate LLM-powered summaries and embeddings, and browse everything through a web UI.

## Features

- **Session import** -- parses JSONL session files from `~/.claude` into SQLite
- **Usage analytics** -- token counts, cost estimates, duration, and tool breakdowns
- **Full-text search** -- FTS5-powered search across all session content
- **LLM summaries** -- generate session summaries via Ollama (or other providers)
- **Embeddings** -- vector embeddings for semantic similarity search
- **Web dashboard** -- Next.js UI with charts, session browser, and insights
- **Export with redaction** -- share sanitized database copies with configurable redaction rules
- **Multi-project & multi-user** -- tag and filter sessions by project or user

## Tech Stack

- **Monorepo**: Turborepo, npm workspaces
- **Language**: TypeScript
- **CLI**: Commander.js
- **Database**: SQLite via better-sqlite3
- **Web UI**: Next.js 15, React 19, Tailwind CSS 4, Recharts, TanStack Table
- **LLM**: Ollama (default provider)
- **Testing**: Vitest

## Quick Start

```bash
npm install
npm run build

# Import your Claude Code sessions
npx cclog import

# Start the web dashboard
npx cclog serve
```

Then open http://localhost:3000.

## CLI Commands

### `cclog import`

Import Claude Code session history into the database.

```
--db <path>          path to SQLite database (default: ./timetravel.db)
--claude-dir <path>  path to Claude config directory (default: ~/.claude)
--project <name>     filter by project path
--since <date>       only import sessions after this ISO 8601 date
--user-id <name>     user identifier to tag sessions (default: $USER)
```

### `cclog summarize`

Generate LLM summaries for sessions that don't have them yet.

```
--db <path>        path to SQLite database (default: ./timetravel.db)
--provider <name>  LLM provider to use (e.g. ollama)
--model <name>     completion model to use
```

### `cclog embed`

Generate and store embeddings for sessions.

```
--db <path>          path to SQLite database (default: ./timetravel.db)
--provider <name>    LLM provider to use (e.g. ollama)
--model <name>       embedding model to use
--batch-size <n>     sessions per batch (default: 5)
```

### `cclog export`

Export a redacted copy of the database.

```
--output <dir>             directory to write export files (required)
--db <path>                path to source database (default: ./timetravel.db)
--redact-tool-outputs      redact all tool output text
--redact-code              redact fenced code blocks
--redact-paths             redact absolute file paths
--redact-pattern <regex>   custom redaction pattern (repeatable)
--user-id <name>           user identifier for exported sessions (default: $USER)
```

### `cclog serve`

Start the web dashboard.

```
--db <path>        path to SQLite database (default: ./timetravel.db)
--port <n>         port to listen on (default: 3000)
--team-dir <path>  directory containing team export files
```

### `cclog config`

View current configuration. Config is stored at `~/.config/cclog/config.json`.

```bash
cclog config                          # print current config
cclog config set llm.provider ollama  # set a value by dot-separated key
```

## Project Structure

```
packages/
  cli/       @cclog/cli     -- CLI tool, importers, DB layer, redaction, LLM providers
  viewer/    @cclog/viewer  -- Next.js web dashboard
  shared/    @cclog/shared  -- shared types, constants, and pricing utilities
```

## License

[MIT](LICENSE)
