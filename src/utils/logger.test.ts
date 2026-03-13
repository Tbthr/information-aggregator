import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  Logger,
  createLogger,
  truncateWithLength,
  maskSensitiveUrl,
  maskSensitiveArgs,
  type LogLevel,
} from "./logger";

describe("truncateWithLength", () => {
  test("returns original text if shorter than max length", () => {
    const result = truncateWithLength("hello", 10);
    expect(result).toBe("hello");
  });

  test("truncates and shows total length if longer than max", () => {
    const result = truncateWithLength("hello world this is a long text", 10);
    expect(result).toBe("hello worl[截取前10字符](总长度: 31)");
  });

  test("handles exact length match", () => {
    const result = truncateWithLength("hello", 5);
    expect(result).toBe("hello");
  });
});

describe("maskSensitiveUrl", () => {
  test("masks key parameter", () => {
    const result = maskSensitiveUrl("https://api.example.com?key=secret123&foo=bar");
    expect(result).toBe("https://api.example.com?key=****&foo=bar");
  });

  test("masks api_key parameter", () => {
    const result = maskSensitiveUrl("https://api.example.com?api_key=secret123");
    expect(result).toBe("https://api.example.com?api_key=****");
  });

  test("masks token parameter", () => {
    const result = maskSensitiveUrl("https://api.example.com?token=abc123");
    expect(result).toBe("https://api.example.com?token=****");
  });

  test("is case insensitive", () => {
    const result = maskSensitiveUrl("https://api.example.com?KEY=secret123");
    expect(result).toBe("https://api.example.com?KEY=****");
  });

  test("returns URL unchanged if no sensitive params", () => {
    const result = maskSensitiveUrl("https://api.example.com?foo=bar");
    expect(result).toBe("https://api.example.com?foo=bar");
  });
});

describe("maskSensitiveArgs", () => {
  test("masks --auth-token value", () => {
    const result = maskSensitiveArgs(["--auth-token", "mysecrettoken123"]);
    expect(result).toEqual(["--auth-token", "myse****"]);
  });

  test("masks --ct0 value", () => {
    const result = maskSensitiveArgs(["--ct0", "short"]);
    expect(result).toEqual(["--ct0", "****"]);
  });

  test("masks --token value", () => {
    const result = maskSensitiveArgs(["--token", "longtokenvalue"]);
    expect(result).toEqual(["--token", "long****"]);
  });

  test("does not mask non-sensitive args", () => {
    const result = maskSensitiveArgs(["--verbose", "--output", "json"]);
    expect(result).toEqual(["--verbose", "--output", "json"]);
  });
});

describe("Logger", () => {
  let outputLines: string[];
  let originalEnv: string | undefined;

  beforeEach(() => {
    outputLines = [];
    originalEnv = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalEnv;
    }
  });

  function createTestLogger(level: LogLevel, source = "test"): Logger {
    return new Logger({ level, source }, (line) => outputLines.push(line));
  }

  describe("log level filtering", () => {
    test("DEBUG level logs all messages", () => {
      const logger = createTestLogger("DEBUG");
      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");
      expect(outputLines.length).toBe(4);
    });

    test("INFO level filters DEBUG", () => {
      const logger = createTestLogger("INFO");
      logger.debug("debug msg");
      logger.info("info msg");
      expect(outputLines.length).toBe(1);
      expect(outputLines[0]).toContain("info msg");
    });

    test("WARN level filters DEBUG and INFO", () => {
      const logger = createTestLogger("WARN");
      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");
      expect(outputLines.length).toBe(2); // warn + error
      expect(outputLines[0]).toContain("warn msg");
      expect(outputLines[1]).toContain("error msg");
    });

    test("SILENT level suppresses all output", () => {
      const logger = createTestLogger("SILENT");
      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      expect(outputLines.length).toBe(0);
    });
  });

  describe("output format", () => {
    test("text format includes timestamp, level, source, message", () => {
      const logger = createTestLogger("INFO", "myapp");
      logger.info("hello world");
      expect(outputLines[0]).toMatch(/\[.*\] \[INFO \] <myapp> hello world/);
    });

    test("text format includes data as JSON", () => {
      const logger = createTestLogger("INFO");
      logger.info("msg", { key: "value" });
      expect(outputLines[0]).toContain('{"key":"value"}');
    });
  });

  describe("createLogger factory", () => {
    test("creates logger with source", () => {
      const logger = createLogger("adapter:rss");
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("child logger", () => {
    test("creates child with extended source", () => {
      const parent = createTestLogger("DEBUG", "parent");
      const child = parent.child("child");
      child.info("test");
      expect(outputLines[0]).toContain("<parent:child>");
    });
  });
});
