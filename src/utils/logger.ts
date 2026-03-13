/**
 * 统一日志模块
 * 支持日志级别、来源标识、敏感信息脱敏
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SILENT";

export interface LoggerOptions {
  /** 最低日志级别，默认从环境变量 LOG_LEVEL 读取，否则 INFO */
  level?: LogLevel;
  /** 日志来源标识（如 adapter 名称、AI provider 名称） */
  source?: string;
  /** 是否启用时间戳，默认 true */
  enableTimestamp?: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

/**
 * 解析日志级别
 */
function parseLogLevel(value: string | undefined): LogLevel {
  const upper = value?.toUpperCase();
  if (
    upper === "DEBUG" ||
    upper === "INFO" ||
    upper === "WARN" ||
    upper === "ERROR" ||
    upper === "SILENT"
  ) {
    return upper;
  }
  return "INFO";
}

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 截取文本并显示总长度
 * @param text 原始文本
 * @param maxLen 最大截取长度
 * @returns 格式化后的文本
 */
export function truncateWithLength(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen)}[截取前${maxLen}字符](总长度: ${text.length})`;
}

/**
 * 脱敏 URL 中的敏感参数
 */
export function maskSensitiveUrl(url: string): string {
  // 保持原始参数名大小写
  return url
    .replace(/([kK][eE][yY])=[^&]+/g, "$1=****")
    .replace(/([aA][pP][iI][_\-]?[kK][eE][yY])=[^&]+/g, "$1=****")
    .replace(/([tT][oO][kK][eE][nN])=[^&]+/g, "$1=****");
}

/**
 * 脱敏 CLI 参数中的敏感值
 */
export function maskSensitiveArgs(args: string[]): string[] {
  return args.map((arg, i) => {
    const prevArg = args[i - 1];
    if (
      prevArg === "--auth-token" ||
      prevArg === "--ct0" ||
      prevArg === "--token" ||
      prevArg === "--api-key" ||
      prevArg === "--key"
    ) {
      return arg.length > 8 ? `${arg.slice(0, 4)}****` : "****";
    }
    return arg;
  });
}

/**
 * 日志器类
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly source: string;
  private readonly enableTimestamp: boolean;
  private readonly format: "text" | "json";
  private readonly output: (line: string) => void;

  constructor(
    options?: LoggerOptions,
    output?: (line: string) => void
  ) {
    this.level = options?.level ?? parseLogLevel(process.env.LOG_LEVEL);
    this.source = options?.source ?? "app";
    this.enableTimestamp = options?.enableTimestamp ?? true;
    this.format = (process.env.LOG_FORMAT as "text" | "json") ?? "text";
    this.output = output ?? console.log;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  private formatEntry(entry: LogEntry): string {
    if (this.format === "json") {
      return JSON.stringify(entry);
    }
    const timestamp = this.enableTimestamp ? `[${entry.timestamp}] ` : "";
    const levelStr = `[${entry.level.padEnd(5)}]`;
    const sourceStr = entry.source ? `<${entry.source}> ` : "";
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
    return `${timestamp}${levelStr} ${sourceStr}${entry.message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: formatTimestamp(),
      level,
      source: this.source,
      message,
      data,
    };

    const formatted = this.formatEntry(entry);
    this.output(formatted);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("DEBUG", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("INFO", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("WARN", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("ERROR", message, data);
  }

  /**
   * 创建子日志器（带相同配置但不同来源）
   */
  child(source: string): Logger {
    return new Logger(
      {
        level: this.level,
        source: `${this.source}:${source}`,
        enableTimestamp: this.enableTimestamp,
      },
      this.output
    );
  }
}

/**
 * 创建带来源标识的 logger
 */
export function createLogger(
  source: string,
  options?: Omit<LoggerOptions, "source">
): Logger {
  return new Logger({ ...options, source });
}

/**
 * 全局默认日志器
 */
export const logger = new Logger();
