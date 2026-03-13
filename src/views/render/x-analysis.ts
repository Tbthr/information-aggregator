import type { XAnalysisViewModel } from "../x-analysis";

/**
 * 格式化数字（简化大数字）
 */
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/**
 * 渲染 X Analysis 视图为 Markdown
 */
export function renderXAnalysisView(model: XAnalysisViewModel): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${model.title}`);

  // 帖子列表
  if (model.posts && model.posts.length > 0) {
    lines.push("", "## 精选帖子", "");

    for (const post of model.posts) {
      const titleLink = post.url ? `[${post.title}](${post.url})` : post.title;
      lines.push("", `### ${titleLink}`);

      // 元数据行
      const metaParts: string[] = [];

      if (post.author) {
        if (post.authorUrl) {
          metaParts.push(`[@${post.author}](${post.authorUrl})`);
        } else {
          metaParts.push(`@${post.author}`);
        }
      }

      // 互动数据
      if (post.engagement) {
        if (post.engagement.likes > 0) {
          metaParts.push(`❤️ ${formatNumber(post.engagement.likes)}`);
        }
        if (post.engagement.retweets > 0) {
          metaParts.push(`🔄 ${formatNumber(post.engagement.retweets)}`);
        }
        if (post.engagement.replies > 0) {
          metaParts.push(`💬 ${formatNumber(post.engagement.replies)}`);
        }
      }

      if (metaParts.length > 0) {
        lines.push("", metaParts.join(" | "));
      }

      // AI 摘要
      if (post.summary) {
        lines.push("", `> ${post.summary}`);
      }

      // 标签
      if (post.tags && post.tags.length > 0) {
        lines.push("", `**标签**: ${post.tags.map((t) => `\`${t}\``).join(" ")}`);
      }

      // 图片
      if (post.media && post.media.length > 0) {
        lines.push("", "## 图片", "");
        for (const media of post.media) {
          lines.push(`![](${media.url})`);
        }
      }

      // 外链
      if (post.article && post.article.url) {
        lines.push("", "## 外链", "");
        lines.push(`[${post.article.title}](${post.article.url})`);
      }

      // 分隔线
      lines.push("", "---");

      // 长文 Thread
      if (post.thread && post.thread.length > 0) {
        lines.push("", "## 长文 Thread", "");
        for (let i = 0; i < post.thread.length; i++) {
          const item = post.thread[i];
          const author = item.author ?? "未知作者";
          const text = item.text ?? "";
          lines.push(`**@${author}**: ${text}`);
          // 在每个 thread 项后添加分隔符（最后一项除外）
          if (i < post.thread.length - 1) {
            lines.push("", "---", "");
          }
        }
      }

      // 完整内容
      if (post.fullText && post.fullText.trim()) {
        lines.push("", "## 原文", "");
        lines.push(post.fullText);
      }
    }
  }

  // 标签云
  if (model.tagCloud && model.tagCloud.length > 0) {
    lines.push("", "## 标签云", "");
    lines.push(model.tagCloud.map((t) => `\`${t}\``).join(" "));
  }

  // 页脚
  lines.push("", "---", `*生成时间: ${new Date().toLocaleString("zh-CN")}*`);

  return lines.join("\n");
}
