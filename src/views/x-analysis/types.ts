/**
 * X Analysis 视图类型定义
 */

import type { ViewModel, ViewModelItem } from "../registry";

/**
 * 媒体项（图片/视频）
 */
export interface XAnalysisMedia {
  type: "photo" | "video" | "animated_gif";
  url: string;
  previewUrl?: string;
}

/**
 * 外链文章
 */
export interface XAnalysisArticle {
  title: string;
  url: string;
  previewText?: string;
}

/**
 * 引用帖子
 */
export interface XAnalysisQuote {
  id?: string;
  text?: string;
  author?: string;
  url?: string;
}

/**
 * Thread 项
 */
export interface XAnalysisThreadItem {
  id?: string;
  text?: string;
  author?: string;
}

/**
 * X Analysis 帖子视图项
 */
export interface XAnalysisPost extends ViewModelItem {
  title: string;
  url: string;
  author?: string;
  authorUrl?: string;
  summary: string;  // AI 生成
  tags: string[];   // AI 生成
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
  // 引用内容字段
  fullText?: string;  // 原始帖子全文
  media?: XAnalysisMedia[];  // 图片/视频数组
  article?: XAnalysisArticle;  // 外链文章
  quote?: XAnalysisQuote;  // 引用帖子
  thread?: XAnalysisThreadItem[];  // thread 数组
}

/**
 * X Analysis 视图模型
 */
export interface XAnalysisViewModel extends ViewModel {
  viewId: "x-analysis";
  title: string;
  posts: XAnalysisPost[];
}
