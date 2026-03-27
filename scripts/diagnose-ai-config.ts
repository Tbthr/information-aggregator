#!/usr/bin/env npx tsx
/**
 * 诊断 AI 配置是否正确加载
 * 运行: npx tsx scripts/diagnose-ai-config.ts
 */
import { readFileSync } from "fs";
import { join } from "path";

// 简单解析 .env 文件（强制覆盖 process.env）
function loadEnvFile() {
  const envPath = join(process.cwd(), ".env");
  try {
    const content = readFileSync(envPath, "utf-8");
    const lines = content.split("\n");
    let loadedCount = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // 去除首尾引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
        loadedCount++;
      }
    }
    console.log(`   .env 文件已加载 (${loadedCount} 个变量)`);
  } catch (e) {
    console.log("   .env 文件加载失败:", e);
  }
}

// 先加载 .env
loadEnvFile();

import { loadAiConfigFromEnv, clearAiConfigCache } from "../src/ai/config/load";

// 清除缓存，确保重新加载
clearAiConfigCache();

console.log("=== AI 配置诊断 ===\n");

// 打印原始环境变量
console.log("1. 原始环境变量 (从 .env 读取):");
console.log("   AI_DEFAULT_PROVIDER:", JSON.stringify(process.env.AI_DEFAULT_PROVIDER));
console.log("   ANTHROPIC_API_KEYS:", JSON.stringify(process.env.ANTHROPIC_API_KEYS));
console.log("   ANTHROPIC_MODEL:", JSON.stringify(process.env.ANTHROPIC_MODEL));
console.log("   ANTHROPIC_BASE_URLS:", JSON.stringify(process.env.ANTHROPIC_BASE_URLS));
console.log("");

// 打印解析后的配置
console.log("2. 解析后的 AI 配置:");
const configResult = loadAiConfigFromEnv();
console.log("   provider:", configResult.provider);
console.log("   anthropic:", JSON.stringify(configResult.anthropic, null, 4));
console.log("");

// 检查问题
console.log("3. 问题检测:");
if (!configResult.anthropic && !configResult.gemini) {
  console.log("   ❌ 没有找到任何有效的 AI provider 配置!");
  console.log("");
  console.log("   排查步骤:");
  console.log("   a) 确认 .env 文件中 ANTHROPIC_API_KEYS 和 ANTHROPIC_MODEL 已设置");
  console.log("   b) 确认 .env 文件在项目根目录");
  console.log("   c) 检查文件权限");
} else if (configResult.anthropic) {
  console.log("   ✅ Anthropic 配置有效");
  console.log("   模型:", configResult.anthropic.model);
  console.log("   endpoints:", configResult.anthropic.endpoints.length);
  console.log("   baseUrl:", configResult.anthropic.endpoints[0]?.baseUrl);
}
