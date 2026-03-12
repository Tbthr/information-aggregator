import { loadAuthByRef } from "../config/load-auth.js";
import { readdir } from "node:fs/promises";

/**
 * 加载所有可用的 auth 配置
 */
async function loadAllAvailableAuths(): Promise<Record<string, Record<string, unknown>>> {
  const authConfigs: Record<string, Record<string, unknown>> = {};
  const authDir = "config/auth";

  try {
    const files = await readdir(authDir);
    const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

    for (const file of yamlFiles) {
      const authRef = file.replace(/\.(ya?ml)$/, "");
      try {
        authConfigs[authRef] = await loadAuthByRef(authRef, authDir);
      } catch {
        // 忽略加载失败
      }
    }
  } catch {
    // 目录不存在
  }

  return authConfigs;
}

/**
 * 验证指定类型的 auth 配置
 */
export async function checkAuthConfig(type: string): Promise<boolean> {
  try {
    const config = await loadAuthByRef(type);

    console.log(`✅ Auth 配置加载成功: ${type}`);
    console.log(`   配置项: ${Object.keys(config).join(", ")}`);

    // 对于 x-family，检查关键配置
    if (type === "x-family") {
      const hasChromeProfile = "chromeProfile" in config;
      const hasCookieSource = "cookieSource" in config;
      const hasToken = "authToken" in config || "ct0" in config;

      if (hasToken) {
        console.log(`   授权方式: 直接 Token`);
      } else if (hasChromeProfile && hasCookieSource) {
        console.log(`   授权方式: Chrome Cookie`);
        console.log(`   Chrome Profile: ${config.chromeProfile}`);
      } else {
        console.warn(`   ⚠️  警告: 缺少有效的授权配置`);
        console.warn(`   请设置 authToken/ct0 或 chromeProfile/cookieSource`);
      }
    }

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`❌ Auth 配置不存在: ${type}`);
      console.error(`   请检查 config/auth/${type}.yaml 文件是否存在`);
    } else {
      console.error(`❌ 加载 Auth 配置失败: ${error}`);
    }
    return false;
  }
}

/**
 * 显示所有 auth 配置状态
 */
export async function showAuthStatus(): Promise<void> {
  console.log("Auth 配置状态:\n");

  const authConfigs = await loadAllAvailableAuths();
  const types = Object.keys(authConfigs);

  if (types.length === 0) {
    console.log("  没有找到任何 auth 配置文件");
    console.log("  请在 config/auth/ 目录下创建配置文件，如 x-family.yaml");
    return;
  }

  for (const type of types) {
    const config = authConfigs[type];
    console.log(`  ${type}:`);
    console.log(`    配置项: ${Object.keys(config).join(", ")}`);

    // 检查是否有有效授权
    const hasToken = "authToken" in config || "ct0" in config;
    const hasChrome = "chromeProfile" in config || "cookieSource" in config;

    if (hasToken || hasChrome) {
      console.log(`    状态: ✅ 已配置`);
    } else {
      console.log(`    状态: ⚠️  未配置授权参数`);
    }
    console.log("");
  }
}
