"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatTokens, formatCost, formatDuration, formatRelativeTime } from "@/lib/format";
import type { SessionRow, MessageRow, ToolUseRow } from "@cc-timetravel/shared";

interface SessionDetail {
  session: SessionRow;
  messages: MessageRow[];
  toolUses: ToolUseRow[];
}

function getToolUsesForMessage(toolUses: ToolUseRow[], messageId: string): ToolUseRow[] {
  return toolUses.filter((t) => t.message_id === messageId);
}

function getToolCounts(toolUses: ToolUseRow[]): Record<string, { count: number; errors: number }> {
  const counts: Record<string, { count: number; errors: number }> = {};
  for (const t of toolUses) {
    if (!counts[t.tool_name]) counts[t.tool_name] = { count: 0, errors: 0 };
    counts[t.tool_name].count++;
    if (t.is_error) counts[t.tool_name].errors++;
  }
  return counts;
}

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/sessions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Session not found");
        return r.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={{ color: "var(--color-text-dim)", fontSize: "11px", padding: "16px" }}>
        loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ color: "var(--color-red)", fontSize: "11px", padding: "16px" }}>
        {error ?? "Session not found"}
      </div>
    );
  }

  const { session, messages, toolUses } = data;
  const toolCounts = getToolCounts(toolUses);
  const cacheTokens = session.total_cache_read_tokens + session.total_cache_creation_tokens;
  const totalTokens =
    session.total_input_tokens + session.total_output_tokens + cacheTokens;
  const cacheHitRate =
    session.total_input_tokens + cacheTokens > 0
      ? Math.round((session.total_cache_read_tokens / (session.total_input_tokens + cacheTokens)) * 100)
      : 0;

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: "12px" }}>
        <Link
          href="/sessions"
          style={{ color: "var(--color-text-muted)", textDecoration: "none", fontSize: "11px" }}
        >
          ← Sessions
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            fontSize: "14px",
            color: "var(--color-text-bright)",
            fontWeight: 700,
            marginBottom: "4px",
          }}
        >
          {session.slug || session.id.slice(0, 8)}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          {session.project_name}
          {session.model && (
            <>
              <span style={{ margin: "0 6px", color: "var(--color-text-dim)" }}>·</span>
              {session.model}
            </>
          )}
          {session.duration_seconds > 0 && (
            <>
              <span style={{ margin: "0 6px", color: "var(--color-text-dim)" }}>·</span>
              <span style={{ color: "var(--color-purple)" }}>
                {formatDuration(session.duration_seconds)}
              </span>
            </>
          )}
          <span style={{ margin: "0 6px", color: "var(--color-text-dim)" }}>·</span>
          {formatRelativeTime(session.created_at)}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        {/* Conversation */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Summary */}
          {session.summary && (
            <div
              style={{
                backgroundColor: "var(--color-bg-raised)",
                border: "1px solid var(--color-border)",
                borderLeft: "3px solid var(--color-purple)",
                borderRadius: "4px",
                padding: "10px 14px",
                marginBottom: "12px",
                fontSize: "11px",
                color: "var(--color-text-muted)",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-purple)",
                  marginBottom: "6px",
                }}
              >
                Summary
              </div>
              {session.summary}
            </div>
          )}

          {/* Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {messages.map((msg) => {
              const msgToolUses = getToolUsesForMessage(toolUses, msg.id);
              const isAssistant = msg.role === "assistant";
              const msgTokens = isAssistant
                ? msg.input_tokens + msg.output_tokens + msg.cache_read_tokens + msg.cache_creation_tokens
                : 0;
              const truncated =
                msg.content_text && msg.content_text.length > 2000
                  ? msg.content_text.slice(0, 2000) + "…"
                  : msg.content_text;

              return (
                <div
                  key={msg.id}
                  style={{
                    backgroundColor: "var(--color-bg-raised)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "4px",
                    padding: "10px 14px",
                  }}
                >
                  {/* Role header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: isAssistant ? "var(--color-blue)" : "var(--color-green)",
                        fontWeight: 700,
                      }}
                    >
                      {isAssistant ? "◀ Assistant" : "▶ User"}
                    </span>
                    {isAssistant && msgTokens > 0 && (
                      <span style={{ fontSize: "10px", color: "var(--color-amber)" }}>
                        {formatTokens(msgTokens)} tokens
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  {truncated && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.6,
                      }}
                    >
                      {truncated}
                    </div>
                  )}

                  {/* Tool uses */}
                  {msgToolUses.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      {msgToolUses.map((tu) => (
                        <div
                          key={tu.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "10px",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          <span style={{ color: "var(--color-text-dim)" }}>⚙</span>
                          <span>{tu.tool_name}</span>
                          {tu.is_error ? (
                            <span
                              style={{
                                fontSize: "9px",
                                color: "var(--color-red)",
                                border: "1px solid var(--color-red)",
                                borderRadius: "2px",
                                padding: "0 3px",
                              }}
                            >
                              error
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div
          style={{
            width: "224px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Stats */}
          <div
            style={{
              backgroundColor: "var(--color-bg-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                borderBottom: "1px solid var(--color-border)",
                fontSize: "9px",
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Stats
            </div>
            {[
              { label: "Messages", value: String(session.message_count), color: "var(--color-text-bright)" },
              {
                label: "Input tokens",
                value: formatTokens(session.total_input_tokens),
                color: "var(--color-amber)",
              },
              {
                label: "Output tokens",
                value: formatTokens(session.total_output_tokens),
                color: "var(--color-amber)",
              },
              {
                label: "Cache hit rate",
                value: `${cacheHitRate}%`,
                color: "var(--color-green)",
              },
              { label: "Total tokens", value: formatTokens(totalTokens), color: "var(--color-amber)" },
              { label: "Total cost", value: formatCost(session.total_cost), color: "var(--color-red)" },
              {
                label: "Duration",
                value: session.duration_seconds ? formatDuration(session.duration_seconds) : "—",
                color: "var(--color-purple)",
              },
              { label: "Model", value: session.model || "—", color: "var(--color-text-muted)" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "5px 12px",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "var(--color-text-dim)", fontSize: "10px" }}>{label}</span>
                <span style={{ color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Tools Used */}
          {Object.keys(toolCounts).length > 0 && (
            <div
              style={{
                backgroundColor: "var(--color-bg-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "6px 12px",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: "9px",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Tools Used
              </div>
              {Object.entries(toolCounts)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([name, { count, errors }]) => (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "4px 12px",
                      borderBottom: "1px solid var(--color-border)",
                      fontSize: "11px",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--color-text-muted)",
                        fontSize: "10px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {name}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                      <span style={{ color: "var(--color-text)" }}>{count}</span>
                      {errors > 0 && (
                        <span style={{ color: "var(--color-red)", fontSize: "10px" }}>
                          {errors}✗
                        </span>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
