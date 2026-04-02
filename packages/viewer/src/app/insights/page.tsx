"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCost, formatRelativeTime } from "@/lib/format";
import type { InsightRow } from "@cclog/shared";

interface InsightsData {
  expensiveSessions: {
    id: string;
    slug: string;
    project_name: string;
    total_cost: number;
    message_count: number;
    created_at: string;
  }[];
  costByProject: {
    project_name: string;
    total_cost: number;
    session_count: number;
  }[];
  topTools: {
    tool_name: string;
    count: number;
    error_count: number;
  }[];
  errorSessions: {
    id: string;
    slug: string;
    project_name: string;
    error_count: number;
    total_cost: number;
  }[];
  insights: InsightRow[];
  modelUsage: {
    model: string;
    session_count: number;
    total_cost: number;
  }[];
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
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
          padding: "8px 14px",
          borderBottom: "1px solid var(--color-border)",
          fontSize: "9px",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function PanelRow({
  left,
  right,
  rightColor = "var(--color-text)",
  sub,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  rightColor?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 14px",
        borderBottom: "1px solid var(--color-border)",
        fontSize: "11px",
        gap: "8px",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {left}
        {sub && (
          <span
            style={{
              marginLeft: "6px",
              fontSize: "10px",
              color: "var(--color-text-dim)",
            }}
          >
            {sub}
          </span>
        )}
      </span>
      <span style={{ color: rightColor, flexShrink: 0 }}>{right}</span>
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((e) => {
        console.error("insights fetch error", e);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ color: "var(--color-text-dim)", fontSize: "11px" }}>
        loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ color: "var(--color-red)", fontSize: "11px" }}>
        Failed to load insights
      </div>
    );
  }

  // Max costs for bar widths
  const maxProjectCost = Math.max(...data.costByProject.map((r) => r.total_cost), 0.001);
  const maxToolCount = Math.max(...data.topTools.map((r) => r.count), 1);

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
        Insights
      </div>

      {/* LLM Insights section */}
      {data.insights.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "9px",
              color: "var(--color-purple)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "8px",
            }}
          >
            LLM Insights
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {data.insights.map((insight) => (
              <div
                key={insight.id}
                style={{
                  backgroundColor: "var(--color-bg-raised)",
                  border: "1px solid var(--color-border)",
                  borderLeft: "3px solid var(--color-purple)",
                  borderRadius: "4px",
                  padding: "10px 14px",
                  fontSize: "11px",
                  color: "var(--color-text-muted)",
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--color-purple)",
                    }}
                  >
                    {insight.insight_type}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--color-text-dim)" }}>
                    {formatRelativeTime(insight.created_at)}
                  </span>
                </div>
                {insight.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2x2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}
      >
        {/* Cost by Project */}
        <Panel title="Cost by Project">
          {data.costByProject.length === 0 && (
            <div
              style={{
                padding: "16px",
                color: "var(--color-text-dim)",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              No data
            </div>
          )}
          {data.costByProject.map((row) => (
            <div
              key={row.project_name}
              style={{
                padding: "6px 14px",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "3px",
                  fontSize: "11px",
                }}
              >
                <span
                  style={{
                    color: "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.project_name}
                </span>
                <span style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <span style={{ color: "var(--color-text-dim)", fontSize: "10px" }}>
                    {row.session_count} sessions
                  </span>
                  <span style={{ color: "var(--color-red)" }}>
                    {formatCost(row.total_cost)}
                  </span>
                </span>
              </div>
              {/* Bar */}
              <div
                style={{
                  height: "2px",
                  backgroundColor: "var(--color-border)",
                  borderRadius: "1px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(row.total_cost / maxProjectCost) * 100}%`,
                    backgroundColor: "var(--color-red)",
                    borderRadius: "1px",
                  }}
                />
              </div>
            </div>
          ))}
        </Panel>

        {/* Most Expensive Sessions */}
        <Panel title="Most Expensive Sessions">
          {data.expensiveSessions.length === 0 && (
            <div
              style={{
                padding: "16px",
                color: "var(--color-text-dim)",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              No data
            </div>
          )}
          {data.expensiveSessions.map((s) => (
            <PanelRow
              key={s.id}
              left={
                <Link
                  href={`/sessions/${s.id}`}
                  style={{ color: "var(--color-blue)", textDecoration: "none" }}
                >
                  {s.slug || s.id.slice(0, 8)}
                </Link>
              }
              sub={`${s.message_count} msgs`}
              right={formatCost(s.total_cost)}
              rightColor="var(--color-red)"
            />
          ))}
        </Panel>

        {/* Tool Usage */}
        <Panel title="Tool Usage">
          {data.topTools.length === 0 && (
            <div
              style={{
                padding: "16px",
                color: "var(--color-text-dim)",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              No data
            </div>
          )}
          {data.topTools.map((row) => (
            <div
              key={row.tool_name}
              style={{
                padding: "5px 14px",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "3px",
                  fontSize: "11px",
                }}
              >
                <span
                  style={{
                    color: "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.tool_name}
                </span>
                <span style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
                  {row.error_count > 0 && (
                    <span style={{ fontSize: "10px", color: "var(--color-red)" }}>
                      {row.error_count} err
                    </span>
                  )}
                  <span style={{ color: "var(--color-text)" }}>{row.count.toLocaleString()}</span>
                </span>
              </div>
              {/* Bar */}
              <div
                style={{
                  height: "2px",
                  backgroundColor: "var(--color-border)",
                  borderRadius: "1px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(row.count / maxToolCount) * 100}%`,
                    backgroundColor: "var(--color-green)",
                    borderRadius: "1px",
                  }}
                />
              </div>
            </div>
          ))}
        </Panel>

        {/* Model Usage */}
        <Panel title="Model Usage">
          {data.modelUsage.length === 0 && (
            <div
              style={{
                padding: "16px",
                color: "var(--color-text-dim)",
                fontSize: "11px",
                textAlign: "center",
              }}
            >
              No data
            </div>
          )}
          {data.modelUsage.map((row) => (
            <PanelRow
              key={row.model}
              left={row.model}
              sub={`${row.session_count} sessions`}
              right={formatCost(row.total_cost)}
              rightColor="var(--color-red)"
            />
          ))}
        </Panel>
      </div>
    </div>
  );
}
