import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readdir, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { validateInlineSource, validateSourcePack, loadAllPacksFromYaml, dedupePacksBySourceUrl } from "./load-pack";
import type { InlineSource, SourcePack } from "../types/index";
import type { PackPolicy, SourcePolicy } from "../types/policy";

describe("validateInlineSource", () => {
  test("validates required fields", () => {
    const input = {
      type: "rss",
      url: "https://example.com/feed.xml",
    };
    const result = validateInlineSource(input);
    expect(result.type).toBe("rss");
    expect(result.url).toBe("https://example.com/feed.xml");
    expect(result.enabled).toBe(true);
  });

  test("preserves optional fields", () => {
    const input = {
      type: "rss",
      url: "https://example.com/feed.xml",
      description: "Example feed",
      enabled: false,
    };
    const result = validateInlineSource(input);
    expect(result.description).toBe("Example feed");
    expect(result.enabled).toBe(false);
  });

  test("throws on missing type", () => {
    expect(() => validateInlineSource({ url: "https://example.com" })).toThrow();
  });

  test("throws on missing url", () => {
    expect(() => validateInlineSource({ type: "rss" })).toThrow();
  });

  test("throws on invalid type", () => {
    expect(() => validateInlineSource({ type: "invalid", url: "https://example.com" })).toThrow();
  });
});

describe("validateSourcePack", () => {
  test("validates required fields", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
      },
      sources: [
        { type: "rss", url: "https://example.com/feed.xml" },
      ],
    };
    const result = validateSourcePack(input);
    expect(result.id).toBe("test-pack");
    expect(result.name).toBe("Test Pack");
    expect(result.sources).toHaveLength(1);
  });

  test("preserves optional fields", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        description: "A test pack",
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.description).toBe("A test pack");
  });

  test("throws on missing pack.id", () => {
    expect(() => validateSourcePack({ pack: { name: "Test" }, sources: [] })).toThrow();
  });

  test("throws on missing pack.name", () => {
    expect(() => validateSourcePack({ pack: { id: "test" }, sources: [] })).toThrow();
  });

  test("preserves auth field", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        auth: "x-family",
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.auth).toBe("x-family");
  });

  test("auth field is optional", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.auth).toBeUndefined();
  });
});

describe("loadAllPacksFromYaml", () => {
  const tempDir = join(process.cwd(), "temp-test-packs");

  beforeEach(async () => {
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loads all pack files from directory", async () => {
    await writeFile(
      join(tempDir, "pack1.yaml"),
      "pack:\n  id: pack1\n  name: Pack 1\nsources:\n  - type: rss\n    url: https://example.com/1.xml"
    );
    await writeFile(
      join(tempDir, "pack2.yaml"),
      "pack:\n  id: pack2\n  name: Pack 2\nsources:\n  - type: rss\n    url: https://example.com/2.xml"
    );

    const result = await loadAllPacksFromYaml(tempDir);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id).sort()).toEqual(["pack1", "pack2"]);
  });

  test("ignores non-yaml files", async () => {
    await writeFile(
      join(tempDir, "pack.yaml"),
      "pack:\n  id: pack\n  name: Pack\nsources: []"
    );
    await writeFile(join(tempDir, "readme.txt"), "not a pack");

    const result = await loadAllPacksFromYaml(tempDir);
    expect(result).toHaveLength(1);
  });

  test("returns empty array for empty directory", async () => {
    const result = await loadAllPacksFromYaml(tempDir);
    expect(result).toEqual([]);
  });
});

describe("dedupePacksBySourceUrl", () => {
  test("removes duplicate URLs across packs", () => {
    const packs: SourcePack[] = [
      {
        id: "pack1",
        name: "Pack 1",
        sources: [
          { type: "rss", url: "https://example.com/feed.xml", enabled: true },
        ],
      },
      {
        id: "pack2",
        name: "Pack 2",
        sources: [
          { type: "rss", url: "https://example.com/feed.xml", enabled: true },
          { type: "rss", url: "https://other.com/feed.xml", enabled: true },
        ],
      },
    ];

    const result = dedupePacksBySourceUrl(packs);
    expect(result[0]?.sources).toHaveLength(1);
    expect(result[1]?.sources).toHaveLength(1);
    expect(result[1]?.sources[0]?.url).toBe("https://other.com/feed.xml");
  });

  test("preserves first occurrence", () => {
    const packs: SourcePack[] = [
      {
        id: "pack1",
        name: "Pack 1",
        sources: [
          { type: "rss", url: "https://example.com/feed.xml", description: "First", enabled: true },
        ],
      },
      {
        id: "pack2",
        name: "Pack 2",
        sources: [
          { type: "rss", url: "https://example.com/feed.xml", description: "Second", enabled: true },
        ],
      },
    ];

    const result = dedupePacksBySourceUrl(packs);
    expect(result[0]?.sources[0]?.description).toBe("First");
  });
});

// ==================== Policy 解析测试 ====================

describe("pack policy parsing", () => {
  test("parses pack policy with mode", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {
          mode: "assist_only",
        },
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.policy).toBeDefined();
    expect(result.policy?.mode).toBe("assist_only");
    expect(result.policy?.filterPrompt).toBeUndefined();
  });

  test("parses pack policy with filterPrompt", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {
          mode: "filter_then_assist",
          filterPrompt: "Only show AI-related content",
        },
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.policy?.mode).toBe("filter_then_assist");
    expect(result.policy?.filterPrompt).toBe("Only show AI-related content");
  });

  test("defaults to filter_then_assist when policy not specified", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.policy).toBeDefined();
    expect(result.policy?.mode).toBe("filter_then_assist");
  });

  test("defaults to filter_then_assist when policy is invalid", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {
          mode: "invalid_mode",
        },
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.policy?.mode).toBe("filter_then_assist");
  });

  test("ignores non-object policy", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: "invalid",
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.policy?.mode).toBe("filter_then_assist");
  });
});

describe("source policy inheritance", () => {
  test("source inherits pack policy when no source policy specified", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {
          mode: "assist_only",
          filterPrompt: "Pack-level prompt",
        },
      },
      sources: [
        { type: "rss", url: "https://example.com/feed.xml" },
      ],
    };
    const result = validateSourcePack(input);
    expect(result.sources[0]?.policy).toBeDefined();
    expect(result.sources[0]?.policy?.mode).toBe("assist_only");
    expect(result.sources[0]?.policy?.filterPrompt).toBe("Pack-level prompt");
    expect(result.sources[0]?.policy?.inheritedFrom).toBe("pack");
  });

  test("source overrides pack policy with own policy", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {
          mode: "assist_only",
        },
      },
      sources: [
        {
          type: "rss",
          url: "https://example.com/feed.xml",
          policy: {
            mode: "filter_then_assist",
            filterPrompt: "Source-level prompt",
          },
        },
      ],
    };
    const result = validateSourcePack(input);
    expect(result.sources[0]?.policy?.mode).toBe("filter_then_assist");
    expect(result.sources[0]?.policy?.filterPrompt).toBe("Source-level prompt");
    expect(result.sources[0]?.policy?.inheritedFrom).toBeUndefined();
  });

  test("source without pack policy has no policy", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        // no policy
      },
      sources: [
        { type: "rss", url: "https://example.com/feed.xml" },
      ],
    };
    const result = validateSourcePack(input);
    // pack 默认有 policy，source 会继承
    expect(result.sources[0]?.policy?.mode).toBe("filter_then_assist");
    expect(result.sources[0]?.policy?.inheritedFrom).toBe("pack");
  });

  test("source with invalid policy falls back to pack policy", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {
          mode: "assist_only",
        },
      },
      sources: [
        {
          type: "rss",
          url: "https://example.com/feed.xml",
          policy: {
            mode: "invalid_mode",
          },
        },
      ],
    };
    const result = validateSourcePack(input);
    expect(result.sources[0]?.policy?.mode).toBe("assist_only");
    expect(result.sources[0]?.policy?.inheritedFrom).toBe("pack");
  });
});

describe("policy default values", () => {
  test("both pack and source without policy uses filter_then_assist", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
      },
      sources: [
        { type: "rss", url: "https://example.com/feed.xml" },
      ],
    };
    const result = validateSourcePack(input);
    expect(result.policy?.mode).toBe("filter_then_assist");
    expect(result.sources[0]?.policy?.mode).toBe("filter_then_assist");
  });

  test("empty policy object defaults to filter_then_assist", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {},
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.policy?.mode).toBe("filter_then_assist");
  });

  test("filterPrompt defaults to undefined when not specified", () => {
    const input = {
      pack: {
        id: "test-pack",
        name: "Test Pack",
        policy: {
          mode: "filter_then_assist",
        },
      },
      sources: [],
    };
    const result = validateSourcePack(input);
    expect(result.policy?.filterPrompt).toBeUndefined();
  });
});
