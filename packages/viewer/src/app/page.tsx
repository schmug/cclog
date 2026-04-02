"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Filters from "@/components/layout/filters";
import StatCard from "@/components/stat-card";
import UsageChart from "@/components/charts/usage-chart";
import ToolBreakdownChart from "@/components/charts/tool-breakdown";
import { formatTokens, formatCost, formatDuration, formatRelativeTime } from "@/lib/format";
import type { ChartDataPoint, ToolBreakdown, SessionRow } from "@cclog/shared";

interface StatsData {
  sessions: number;
  messages: number;
  totalTokens: number;
  totalCost: number;
  avgDurationSeconds: number;
  projects: string[];
  users: string[];
}

interface ChartsData {
  chartData: ChartDataPoint[];
  toolBreakdown: ToolBreakdown[];
}

interface SessionsData {
  sessions: SessionRow[];
  total: number;
}

function buildParams(timeRange: string, project: string, userId: string): string {
  const p = new URLSearchParams();
  if (timeRange) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(timeRange, 10));
    p.set("since", d.toISOString().split("T")[0]);
  }
  if (project) p.set("project", project);
  if (userId) p.set("userId", userId);
  return p.toString() ? `?${p.toString()}` : "";
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState("");
  const [project, setProject] = useState("");
  const [userId, setUserId] = useState("");

  const [stats, setStats] = useState<StatsData | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [sessions, setSessions] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const qs = buildParams(timeRange, project, userId);
    try {
      const [statsRes, chartsRes, sessionsRes] = await Promise.all([
        fetch(`/api/stats${qs}`),
        fetch(`/api/charts${qs}`),
        fetch(`/api/sessions${qs}&limit=10&sort=created_at&dir=DESC`),
      ]);
      const [statsData, chartsData, sessionsData] = await Promise.all([
        statsRes.json(),
        chartsRes.json(),
        sessionsRes.json(),
      ]);
      setStats(statsData);
      setCharts(chartsData);
      setSessions(sessionsData);
    } catch (e) {
      console.error("fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [timeRange, project, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allProjects = stats?.projects ?? [];
  const allUsers = stats?.users ?? [];

  return (
    <div>
      <Filters
        timeRange={timeRange}
        project={project}
        userId={userId}
        projects={allProjects}
        users={allUsers}
        onTimeRange={setTimeRange}
        onProject={setProject}
        onUser={setUserId}
      />

      {loading && (
        <div
          style={{
            color: "var(--color-text-dim)",
            fontSize: "11px",
            marginBottom: "12px",
          }}
        >
          loading...
        </div>
      )}

      {/* Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <StatCard
          label="Sessions"
          value={stats ? stats.sessions.toLocaleString() : "—"}
          color="var(--color-green)"
        />
        <StatCard
          label="Messages"
          value={stats ? stats.messages.toLocaleString() : "—"}
          color="var(--color-text-bright)"
        />
        <StatCard
          label="Total Tokens"
          value={stats ? formatTokens(stats.totalTokens) : "—"}
          color="var(--color-amber)"
        />
        <StatCard
          label="Total Cost"
          value={stats ? formatCost(stats.totalCost) : "—"}
          color="var(--color-red)"
        />
        <StatCard
          label="Avg Duration"
          value={stats ? formatDuration(Math.round(stats.avgDurationSeconds)) : "—"}
          color="var(--color-purple)"
        />
      </div>

      {/* Charts Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <UsageChart data={charts?.chartData ?? []} />
        <ToolBreakdownChart data={charts?.toolBreakdown ?? []} />
      </div>

      {/* Recent Sessions */}
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
            padding: "8px 16px",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "9px",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Recent Sessions</span>
          {sessions && (
            <span style={{ color: "var(--color-text-dim)" }}>
              {sessions.total.toLocaleString()} total
            </span>
          )}
        </div>

        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 1.5fr 60px 80px 70px 80px",
            padding: "6px 16px",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "9px",
            color: "var(--color-text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <span>Session</span>
          <span>Project</span>
          <span>Msgs</span>
          <span>Tokens</span>
          <span>Cost</span>
          <span>Time</span>
        </div>

        {sessions?.sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: "grid",
              gridTemplateColumns: "3fr 1.5fr 60px 80px 70px 80px",
              padding: "6px 16px",
              borderBottom: "1px solid var(--color-border)",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor =
                "var(--color-bg-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <Link
                href={`/sessions/${s.id}`}
                style={{
                  color: "var(--color-blue)",
                  textDecoration: "none",
                  fontSize: "11px",
                }}
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
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
              {formatRelativeTime(s.created_at)}
            </span>
          </div>
        ))}

        {sessions?.sessions.length === 0 && (
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

        <div
          style={{
            padding: "8px 16px",
            borderTop: sessions?.sessions.length ? "1px solid var(--color-border)" : "none",
          }}
        >
          <Link
            href="/sessions"
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              textDecoration: "none",
            }}
          >
            View all sessions →
          </Link>
        </div>
      </div>
    </div>
  );
}
