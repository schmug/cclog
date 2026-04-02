import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { SearchResult } from "@cclog/shared";

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const mode = searchParams.get("mode") ?? "keyword";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  if (mode === "semantic") {
    return NextResponse.json({
      results: [],
      message: "Semantic search requires embeddings to be generated. Run 'cclog embed' first.",
    });
  }

  const db = getDb();

  try {
    // FTS5 keyword search with snippet highlighting
    // Deduplicate by session_id keeping best rank
    const rows = db
      .prepare(
        `SELECT
          si.session_id,
          s.slug,
          s.project_name,
          snippet(search_index, 1, '»', '«', '...', 40) as snippet,
          rank as score,
          s.created_at,
          s.message_count,
          s.total_cost
        FROM search_index si
        JOIN sessions s ON s.id = si.session_id
        WHERE search_index MATCH ?
        ORDER BY rank
        LIMIT ?`
      )
      .all(q, limit * 5) as {
      session_id: string;
      slug: string;
      project_name: string;
      snippet: string;
      score: number;
      created_at: string;
      message_count: number;
      total_cost: number;
    }[];

    // Deduplicate by session_id (keep first/best rank per session)
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const row of rows) {
      if (seen.has(row.session_id)) continue;
      seen.add(row.session_id);
      results.push({
        sessionId: row.session_id,
        slug: row.slug,
        projectName: row.project_name,
        snippet: row.snippet,
        score: row.score,
        createdAt: row.created_at,
        messageCount: row.message_count,
        totalCost: row.total_cost,
      });
      if (results.length >= limit) break;
    }

    return NextResponse.json({ results });
  } catch (e) {
    // FTS5 query syntax errors surface here
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ results: [], error: `Search error: ${msg}` });
  }
}
