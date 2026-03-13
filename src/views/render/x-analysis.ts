import type { XAnalysisViewModel, XAnalysisPost } from "../x-analysis";

/**
 * 格式化数字（简化大数字）
 */
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/**
 * 渲染单个帖子
 *
 * 排版结构：
 * 1. 帖子标题（链接到原推）
 * 2. 作者和时间信息
 * 3. AI 摘要（引用块）
 * 4. 互动数据（一行显示）
 * 5. 媒体区（如有）
 * 6. 外链文章（如有）
 * 7. 引用推文（如有）
 * 8. 回复的推文（如有）
 * 9. 长文 Thread（如有）
 * 10. 标签
 * 11. 元数据区（ID、外链等）
 */
function renderPost(post: XAnalysisPost): string {
  const lines: string[] = [];

  // 1. 标题
  const titleLink = post.url ? `[${post.title}](${post.url})` : post.title;
  lines.push(`### ${titleLink}`);
  lines.push("");

  // 2. 作者和时间
  const authorParts: string[] = [];
  if (post.author) {
    const authorUrl = post.authorUrl ?? `https://x.com/${post.author}`;
    authorParts.push(`[@${post.author}](${authorUrl})`);
  }
  if (post.authorName) {
    authorParts.push(post.authorName);
  }
  if (post.publishedAt) {
    authorParts.push(post.publishedAt);
  }
  if (authorParts.length > 0) {
    lines.push(authorParts.join(" · "));
    lines.push("");
  }

  // 3. AI 摘要
  if (post.summary) {
    lines.push(`> ${post.summary}`);
    lines.push("");
  }

  // 4. 互动数据
  if (post.engagement) {
    const engagementParts: string[] = [];
    if (post.engagement.likes > 0) {
      engagementParts.push(`❤️ ${formatNumber(post.engagement.likes)}`);
    }
    if (post.engagement.replies > 0) {
      engagementParts.push(`💬 ${formatNumber(post.engagement.replies)}`);
    }
    if (post.engagement.retweets > 0) {
      engagementParts.push(`🔄 ${formatNumber(post.engagement.retweets)}`);
    }
    if (engagementParts.length > 0) {
      lines.push(`**互动**: ${engagementParts.join(" · ")}`);
      lines.push("");
    }
  }

  // 5. 媒体区
  if (post.media && post.media.length > 0) {
    lines.push("**媒体**:");
    post.media.forEach((m) => {
      if (m.type === "photo") {
        lines.push(`![${m.type}](${m.url})`);
      } else {
        lines.push(`- [${m.type}](${m.url})`);
      }
    });
    lines.push("");
  }

  // 6. 外链文章
  if (post.article && post.article.url) {
    lines.push("**外链文章**:");
    const articleUrl = post.article.url || post.expandedUrl;
    lines.push(`- [${post.article.title}](${articleUrl})`);
    if (post.article.previewText) {
      const preview = post.article.previewText.length > 200
        ? `${post.article.previewText.slice(0, 200)}...`
        : post.article.previewText;
      lines.push(`  > ${preview}`);
    }
    lines.push("");
  }

  // 7. 引用推文
  if (post.quote && (post.quote.text || post.quote.author)) {
    lines.push("**引用**:");
    const author = post.quote.author ?? "unknown";
    const text = post.quote.text ? post.quote.text.slice(0, 200) : "";
    lines.push(`> @${author}: ${text}${post.quote.text && post.quote.text.length > 200 ? "..." : ""}`);
    lines.push("");
  }

  // 8. 回复的推文
  if (post.parent && (post.parent.text || post.parent.author)) {
    lines.push("**回复**:");
    const author = post.parent.author ?? "unknown";
    const text = post.parent.text ? post.parent.text.slice(0, 200) : "";
    lines.push(`> @${author}: ${text}${post.parent.text && post.parent.text.length > 200 ? "..." : ""}`);
    lines.push("");
  }

  // 9. 长文 Thread
  if (post.thread && post.thread.length > 0) {
    lines.push("**Thread**:");
    post.thread.forEach((t, i) => {
      const text = t.text ? t.text.slice(0, 200) : "";
      lines.push(`${i + 1}. ${text}${t.text && t.text.length > 200 ? "..." : ""}`);
    });
    lines.push("");
  }

  // 10. 标签
  if (post.tags && post.tags.length > 0) {
    lines.push(`**标签**: ${post.tags.map((t) => `\`${t}\``).join(" ")}`);
    lines.push("");
  }

  // 11. 元数据区
  const metaParts: string[] = [];
  if (post.expandedUrl) {
    metaParts.push(`[外链](${post.expandedUrl})`);
  }
  if (metaParts.length > 0) {
    lines.push(`---\n*${metaParts.join(" · ")}*`);
  }

  return lines.join("\n");
}

/**
 * 渲染 X Analysis 视图为 Markdown
 */
export function renderXAnalysisView(model: XAnalysisViewModel): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${model.title}`);
  lines.push("");

  // 精选帖子
  lines.push("## 精选帖子");
  lines.push("");

  // 渲染每个帖子
  model.posts.forEach((post) => {
    lines.push(renderPost(post));
    lines.push("---");
    lines.push("");
  });

  // 生成时间
  lines.push(`*生成时间: ${new Date().toLocaleString("zh-CN")}*`);

  return lines.join("\n");
}
