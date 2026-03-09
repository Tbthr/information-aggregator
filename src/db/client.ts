import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDb(path: string): Database {
  const db = new Database(path);
  db.exec(readFileSync(join(__dirname, "migrations", "001_init.sql"), "utf8"));
  return db;
}
