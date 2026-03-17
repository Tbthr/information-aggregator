/**
 * Policy 类型定义
 * 用于控制内容处理流程的配置策略
 */

/**
 * 策略模式
 * - assist_only: 仅 AI 辅助处理
 * - filter_then_assist: 先过滤再 AI 辅助
 */
export type PolicyMode = 'assist_only' | 'filter_then_assist';

/**
 * Pack 级别策略配置
 */
export interface PackPolicy {
  mode: PolicyMode;
  filterPrompt?: string;
}

/**
 * Source 级别策略配置
 * 继承自 Pack 策略，支持覆盖
 */
export interface SourcePolicy extends PackPolicy {
  inheritedFrom?: string;
}
