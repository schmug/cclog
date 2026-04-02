import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { SessionRow } from "@cclog/shared";

const ALLOWED_SORT_COLUMNS = new Set([
  "created_at",
  "total_cost",
  "message_count",
  "total_input_tokens",
  "duration_seconds",
]);

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const project = searchParams.get("project");
  const userId = searchParams.get("userId");
  const sort = searchParams.get("sort") ?? "created_at";
  const dir = searchParams.get("dir")?.toUpperCase() === "ASC" ? "ASC" : "DESC";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const sortColumn = ALLOWED_SORT_COLUMNS.has(sort) ? sort : "created_at";

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

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM sessions ${where}`).get(...params) as {
      count: number;
    }
  ).count;

  const sessions = db
    .prepare(
      `SELECT * FROM sessions ${where} ORDER BY ${sortColumn} ${dir} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as SessionRow[];

  return NextResponse.json({ sessions, total });
}
