import Database from "better-sqlite3";
import { initializeDatabase } from "./schema.js";

export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  initializeDatabase(db);
  return db;
}
