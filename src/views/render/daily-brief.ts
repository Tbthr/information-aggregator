import type { ViewModel } from "../registry";
import type { DailyBriefViewModel } from "../daily-brief";

/**
 * 渲染 Daily Brief 视图为 Markdown
 */
export function renderDailyBriefView(model: ViewModel): string {
  const briefModel = model as DailyBriefViewModel;
  const lines: string[] = ["# Daily Digest", ""];

  // AI 整体摘要
  if (briefModel.summary) {
    lines.push("## 今日看点", "", briefModel.summary);
  }

  // AI 高亮
  if (briefModel.highlights && briefModel.highlights.length > 0) {
    lines.push("", "### 主要看点", "");
    for (const h of briefModel.highlights) {
      lines.push(`- ${h}`);
    }
  }

  // 文章列表
  if (briefModel.articles && briefModel.articles.length > 0) {
    lines.push("", "## 精选文章", "");
    for (const article of briefModel.articles) {
      const titleLink = article.url ? `[${article.title}](${article.url})` : article.title;
      lines.push("", `### ${titleLink}`);

      if (article.description) {
        lines.push("", `> ${article.description}`);
      }

      if (article.whyMatters) {
        lines.push("", `**为什么值得关注**: ${article.whyMatters}`);
      }

      if (article.tags && article.tags.length > 0) {
        lines.push("", `**标签**: ${article.tags.map((t) => `\`${t}\``).join(" ")}`);
      }
    }
  }

  // 标签云
  if (briefModel.tagCloud && briefModel.tagCloud.length > 0) {
    lines.push("", "## 标签云", "");
    lines.push(briefModel.tagCloud.map((t) => `\`${t}\``).join(" "));
  }

  // 页脚
  lines.push("", "---", `*生成时间: ${new Date().toLocaleString("zh-CN")}*`);

  return lines.join("\n");
}
