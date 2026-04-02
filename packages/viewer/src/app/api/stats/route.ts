import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const project = searchParams.get("project");
  const userId = searchParams.get("userId");

  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (since) {
    conditions.push("created_at >= ?");
    params.push(since);
  }
  if (until) {
    conditions.push("created_at <= ?");
    params.push(until);
  }
  if (project) {
    conditions.push("project_name = ?");
    params.push(project);
  }
  if (userId) {
    conditions.push("user_id = ?");
    params.push(userId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as sessions,
        COALESCE(SUM(message_count), 0) as messages,
        COALESCE(SUM(total_input_tokens + total_output_tokens + total_cache_read_tokens + total_cache_creation_tokens), 0) as totalTokens,
        COALESCE(SUM(total_cost), 0) as totalCost,
        COALESCE(AVG(duration_seconds), 0) as avgDurationSeconds
      FROM sessions ${where}`
    )
    .get(...params) as {
    sessions: number;
    messages: number;
    totalTokens: number;
    totalCost: number;
    avgDurationSeconds: number;
  };

  const projects = (
    db
      .prepare(`SELECT DISTINCT project_name FROM sessions ${where} ORDER BY project_name`)
      .all(...params) as { project_name: string }[]
  ).map((r) => r.project_name);

  const users = (
    db
      .prepare(`SELECT DISTINCT user_id FROM sessions ${where} ORDER BY user_id`)
      .all(...params) as { user_id: string }[]
  ).map((r) => r.user_id);

  return NextResponse.json({ ...stats, projects, users });
}
