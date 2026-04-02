import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { SessionRow, MessageRow, ToolUseRow } from "@cclog/shared";

export function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return params.then(({ id }) => {
    const db = getDb();

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as SessionRow | undefined;

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = db
      .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC")
      .all(id) as MessageRow[];

    const toolUses = db
      .prepare("SELECT * FROM tool_uses WHERE session_id = ? ORDER BY timestamp ASC")
      .all(id) as ToolUseRow[];

    return NextResponse.json({ session, messages, toolUses });
  });
}
