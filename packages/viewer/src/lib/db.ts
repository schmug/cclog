import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath =
    process.env.TIMETRAVEL_DB ?? path.join(process.cwd(), "timetravel.db");
  db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}
