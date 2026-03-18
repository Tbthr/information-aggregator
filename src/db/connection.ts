/**
 * 数据库连接管理器
 * 提供单例模式，避免频繁创建/关闭连接
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 创建数据库并应用 schema
 */
function initDb(path: string): Database {
  const db = new Database(path);
  db.exec(readFileSync(join(__dirname, "migrations", "001_init.sql"), "utf8"));
  return db;
}

let dbInstance: Database | null = null;
let dbPath: string = "data/archive.db";

/**
 * 获取数据库单例连接
 * @param path 数据库路径，默认 data/archive.db
 */
export function getDb(path = "data/archive.db"): Database {
  // 如果路径变化，关闭旧连接
  if (dbInstance && path !== dbPath) {
    closeDb();
  }

  if (!dbInstance) {
    dbPath = path;
    dbInstance = initDb(path);
  }

  return dbInstance;
}

/**
 * 关闭数据库连接
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPath = "";
  }
}

/**
 * 重置数据库连接（用于测试）
 */
export function resetDb(): void {
  closeDb();
}

/**
 * 获取当前数据库路径
 */
export function getDbPath(): string {
  return dbPath;
}

/**
 * 检查连接是否活跃
 */
export function isDbConnected(): boolean {
  return dbInstance !== null;
}
