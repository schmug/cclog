import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ChartDataPoint, ToolBreakdown } from "@cc-timetravel/shared";

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

  const chartData = db
    .prepare(
      `SELECT
        date(created_at) as date,
        COUNT(*) as sessions,
        COALESCE(SUM(total_input_tokens + total_output_tokens + total_cache_read_tokens + total_cache_creation_tokens), 0) as tokens,
        COALESCE(SUM(total_cost), 0) as cost
      FROM sessions ${where}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC`
    )
    .all(...params) as ChartDataPoint[];

  // Tool breakdown: count tool uses matching session filters
  const toolConditions: string[] = [];
  const toolParams: unknown[] = [];

  if (since || until || project || userId) {
    const sessionSubquery = `SELECT id FROM sessions ${where}`;
    toolConditions.push(`session_id IN (${sessionSubquery})`);
    toolParams.push(...params);
  }

  const toolWhere =
    toolConditions.length > 0 ? `WHERE ${toolConditions.join(" AND ")}` : "";

  const toolCounts = db
    .prepare(
      `SELECT tool_name, COUNT(*) as count FROM tool_uses ${toolWhere} GROUP BY tool_name ORDER BY count DESC LIMIT 10`
    )
    .all(...toolParams) as { tool_name: string; count: number }[];

  const totalToolUses = toolCounts.reduce((sum, t) => sum + t.count, 0);

  const toolBreakdown: ToolBreakdown[] = toolCounts.map((t) => ({
    tool_name: t.tool_name,
    count: t.count,
    percentage: totalToolUses > 0 ? (t.count / totalToolUses) * 100 : 0,
  }));

  return NextResponse.json({ chartData, toolBreakdown });
}
