import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { InsightRow } from "@cclog/shared";

export function GET() {
  const db = getDb();

  const expensiveSessions = db
    .prepare(
      `SELECT id, slug, project_name, total_cost, message_count, created_at
       FROM sessions
       ORDER BY total_cost DESC
       LIMIT 10`
    )
    .all() as {
    id: string;
    slug: string;
    project_name: string;
    total_cost: number;
    message_count: number;
    created_at: string;
  }[];

  const costByProject = db
    .prepare(
      `SELECT
        project_name,
        SUM(total_cost) as total_cost,
        COUNT(*) as session_count
       FROM sessions
       GROUP BY project_name
       ORDER BY total_cost DESC
       LIMIT 10`
    )
    .all() as { project_name: string; total_cost: number; session_count: number }[];

  const topTools = db
    .prepare(
      `SELECT
        tool_name,
        COUNT(*) as count,
        SUM(is_error) as error_count
       FROM tool_uses
       GROUP BY tool_name
       ORDER BY count DESC
       LIMIT 15`
    )
    .all() as { tool_name: string; count: number; error_count: number }[];

  const errorSessions = db
    .prepare(
      `SELECT
        s.id,
        s.slug,
        s.project_name,
        COUNT(t.id) as error_count,
        s.total_cost
       FROM sessions s
       JOIN tool_uses t ON t.session_id = s.id AND t.is_error = 1
       GROUP BY s.id
       ORDER BY error_count DESC
       LIMIT 10`
    )
    .all() as {
    id: string;
    slug: string;
    project_name: string;
    error_count: number;
    total_cost: number;
  }[];

  const insights = db
    .prepare(`SELECT * FROM insights ORDER BY created_at DESC LIMIT 50`)
    .all() as InsightRow[];

  const modelUsage = db
    .prepare(
      `SELECT
        model,
        COUNT(*) as session_count,
        SUM(total_cost) as total_cost
       FROM sessions
       WHERE model != ''
       GROUP BY model
       ORDER BY session_count DESC`
    )
    .all() as { model: string; session_count: number; total_cost: number }[];

  return NextResponse.json({
    expensiveSessions,
    costByProject,
    topTools,
    errorSessions,
    insights,
    modelUsage,
  });
}
