import { serve } from "bun";
import { createServer } from "../../api/server";

export interface ServeOptions {
  port?: number;
  dbPath?: string;
}

/**
 * serve 命令：启动 API 服务器
 */
export async function serveCommand(options: ServeOptions = {}): Promise<void> {
  const port = options.port ?? 3000;
  const dbPath = options.dbPath ?? "data/archive.db";

  console.log(`Starting server on port ${port}...`);
  console.log(`Database: ${dbPath}`);

  const app = createServer({ dbPath });

  const server = serve({
    port,
    fetch: app.fetch,
  });

  console.log(`\nServer running at http://localhost:${port}`);
  console.log("\nAPI Endpoints:");
  console.log(`  GET http://localhost:${port}/api/items`);
  console.log(`  GET http://localhost:${port}/api/packs`);
  console.log(`  GET http://localhost:${port}/api/health`);
  console.log("\nPress Ctrl+C to stop");

  // 保持进程运行
  await new Promise(() => {});
}
