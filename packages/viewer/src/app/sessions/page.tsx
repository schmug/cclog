"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatTokens, formatCost, formatDuration, formatRelativeTime } from "@/lib/format";
import type { SessionRow } from "@cclog/shared";

type SortColumn = "created_at" | "total_cost" | "message_count" | "total_input_tokens" | "duration_seconds";
type SortDir = "asc" | "desc";

interface SessionsData {
  sessions: SessionRow[];
  total: number;
}

const COLUMNS: { label: string; key: SortColumn | null; width: string }[] = [
  { label: "Session", key: null, width: "3fr" },
  { label: "Project", key: null, width: "1.5fr" },
  { label: "Msgs", key: "message_count", width: "60px" },
  { label: "Tokens", key: "total_input_tokens", width: "80px" },
  { label: "Cost", key: "total_cost", width: "70px" },
  { label: "Model", key: null, width: "80px" },
  { label: "Duration", key: "duration_seconds", width: "70px" },
  { label: "Date", key: "created_at", width: "90px" },
];

const GRID_COLS = COLUMNS.map((c) => c.width).join(" ");
const LIMIT = 50;

export default function SessionsPage() {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortColumn>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        dir: sortDir,
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      });
      const res = await fetch(`/api/sessions?${params}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [page, sort, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSort(col: SortColumn) {
    if (sort === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setSortDir("desc");
    }
    setPage(0);
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  return (
    <div>
      <div
        style={{
          fontSize: "9px",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "12px",
        }}
      >
        Sessions
        {data && (
          <span style={{ color: "var(--color-text-dim)", marginLeft: "8px" }}>
            {data.total.toLocaleString()} total
          </span>
        )}
      </div>

      <div
        style={{
          backgroundColor: "var(--color-bg-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID_COLS,
            padding: "6px 16px",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "9px",
            color: "var(--color-text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {COLUMNS.map((col) => (
            <span
              key={col.label}
              onClick={col.key ? () => handleSort(col.key!) : undefined}
              style={{
                cursor: col.key ? "pointer" : "default",
                userSelect: "none",
                color: col.key && sort === col.key ? "var(--color-text-bright)" : undefined,
              }}
            >
              {col.label}
              {col.key && sort === col.key && (
                <span style={{ marginLeft: "4px" }}>
                  {sortDir === "asc" ? "↑" : "↓"}
                </span>
              )}
            </span>
          ))}
        </div>

        {loading && (
          <div
            style={{
              padding: "16px",
              color: "var(--color-text-dim)",
              fontSize: "11px",
              textAlign: "center",
            }}
          >
            loading...
          </div>
        )}

        {!loading && data?.sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLS,
              padding: "6px 16px",
              borderBottom: "1px solid var(--color-border)",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--color-bg-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <Link
                href={`/sessions/${s.id}`}
                style={{ color: "var(--color-blue)", textDecoration: "none", fontSize: "11px" }}
              >
                {s.first_prompt
                  ? s.first_prompt.slice(0, 60) + (s.first_prompt.length > 60 ? "…" : "")
                  : s.slug || s.id.slice(0, 8)}
              </Link>
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.project_name}
            </span>
            <span style={{ fontSize: "11px", color: "var(--color-text)" }}>
              {s.message_count}
            </span>
            <span style={{ fontSize: "11px", color: "var(--color-amber)" }}>
              {formatTokens(
                s.total_input_tokens +
                  s.total_output_tokens +
                  s.total_cache_read_tokens +
                  s.total_cache_creation_tokens
              )}
            </span>
            <span style={{ fontSize: "11px", color: "var(--color-red)" }}>
              {formatCost(s.total_cost)}
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-text-dim)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.model ? s.model.split("-").slice(0, 2).join("-") : "—"}
            </span>
            <span style={{ fontSize: "11px", color: "var(--color-purple)" }}>
              {s.duration_seconds ? formatDuration(s.duration_seconds) : "—"}
            </span>
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
              {formatRelativeTime(s.created_at)}
            </span>
          </div>
        ))}

        {!loading && data?.sessions.length === 0 && (
          <div
            style={{
              padding: "16px",
              color: "var(--color-text-dim)",
              fontSize: "11px",
              textAlign: "center",
            }}
          >
            No sessions found
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "11px",
              color: "var(--color-text-muted)",
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                background: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "3px",
                color: page === 0 ? "var(--color-text-dim)" : "var(--color-text)",
                cursor: page === 0 ? "default" : "pointer",
                padding: "3px 8px",
                fontSize: "11px",
                fontFamily: "inherit",
              }}
            >
              ← prev
            </button>
            <span>
              page {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                background: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "3px",
                color: page >= totalPages - 1 ? "var(--color-text-dim)" : "var(--color-text)",
                cursor: page >= totalPages - 1 ? "default" : "pointer",
                padding: "3px 8px",
                fontSize: "11px",
                fontFamily: "inherit",
              }}
            >
              next →
            </button>
            {data && (
              <span style={{ marginLeft: "auto", color: "var(--color-text-dim)" }}>
                {(page * LIMIT + 1).toLocaleString()}–
                {Math.min((page + 1) * LIMIT, data.total).toLocaleString()} of{" "}
                {data.total.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
