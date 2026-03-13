/**
 * 调试输出工具
 */

import { createLogger } from "../../utils/logger";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const logger = createLogger("views:x-analysis:debug");

const DEBUG_X_CONTENT = process.env.DEBUG_X_CONTENT === "true";
const DEBUG_CONTENT_DIR = "out/bird-content";

/**
 * 保存内容提取调试输出
 */
export function saveContentDebug(
  postId: string,
  url: string,
  title: string,
  source: string,
  content: string,
): void {
  if (!DEBUG_X_CONTENT) {
    return;
  }

  try {
    mkdirSync(DEBUG_CONTENT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${postId}_${timestamp}.txt`;
    const filepath = join(DEBUG_CONTENT_DIR, filename);

    const debugContent = [
      `=== 帖子内容提取调试 ===`,
      `URL: ${url}`,
      `标题: ${title}`,
      `内容来源: ${source}`,
      `内容长度: ${content.length}`,
      ``,
      `=== 内容 ===`,
      content,
    ].join("\n");

    writeFileSync(filepath, debugContent, "utf-8");
    logger.info("Saved content debug output", { filepath, postId, source, contentLength: content.length });
  } catch (err) {
    logger.warn("Failed to save content debug output", { error: String(err), postId });
  }
}
