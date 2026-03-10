import { describe, expect, test } from "bun:test";

import { validateSource } from "./validate";

describe("validateSource source-type specific schema", () => {
  test("requires config.path for opml_rss sources", () => {
    expect(() =>
      validateSource({
        id: "opml-source",
        name: "OPML Source",
        type: "opml_rss",
        enabled: false,
        config: {},
      }),
    ).toThrow("Source opml-source (opml_rss) requires config.path");
  });

  test("requires itemPath and field mapping for custom_api sources", () => {
    expect(() =>
      validateSource({
        id: "custom-api-source",
        name: "Custom API Source",
        type: "custom_api",
        enabled: false,
        config: {
          itemPath: "$.items",
        },
      }),
    ).toThrow("Source custom-api-source (custom_api) requires config.fieldMap");
  });

  test("requires link hint or format for digest_feed sources", () => {
    expect(() =>
      validateSource({
        id: "digest-source",
        name: "Digest Source",
        type: "digest_feed",
        enabled: false,
        config: {},
      }),
    ).toThrow("Source digest-source (digest_feed) requires config.format or config.linkSelector");
  });

  test("requires itemPath for json digest_feed sources", () => {
    expect(() =>
      validateSource({
        id: "digest-source",
        name: "Digest Source",
        type: "digest_feed",
        enabled: false,
        config: {
          format: "json",
        },
      }),
    ).toThrow("Source digest-source (digest_feed) requires config.itemPath for json format");
  });

  test("allows lightweight config for github_trending sources", () => {
    const source = validateSource({
      id: "github-trending-source",
      name: "GitHub Trending",
      type: "github_trending",
      enabled: false,
      config: {
        since: "daily",
      },
    });

    expect(source.type).toBe("github_trending");
  });

  test("requires birdMode for x family sources", () => {
    expect(() =>
      validateSource({
        id: "x-list-source",
        name: "X List",
        type: "x_list",
        enabled: false,
        config: {},
      }),
    ).toThrow("Source x-list-source (x_list) requires config.birdMode");
  });

  test("accepts optional browser-auth settings for x family sources", () => {
    const source = validateSource({
      id: "x-home-source",
      name: "X Home",
      type: "x_home",
      enabled: false,
      config: {
        birdMode: "home",
        chromeProfile: "Default",
        cookieSource: ["chrome"],
      },
    });

    expect(source.type).toBe("x_home");
  });

  test("allows non-runnable schema placeholders to skip runnable fields", () => {
    const source = validateSource({
      id: "schema-placeholder",
      name: "Schema Placeholder",
      type: "custom_api",
      enabled: false,
      config: {
        placeholderMode: "schema",
      },
    });

    expect(source.id).toBe("schema-placeholder");
  });
});
