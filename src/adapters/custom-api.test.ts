import { describe, expect, test } from "bun:test";

import { collectCustomApiSource } from "./custom-api";

describe("collectCustomApiSource", () => {
  test("maps fixture json with field mappings into raw items", async () => {
    const fetchImpl = (async () => new Response(
      JSON.stringify({
        items: [
          {
            headline: "Mapped Entry",
            link: "https://example.com/mapped",
            summary: "Mapped summary",
          },
        ],
      }),
    )) as unknown as typeof fetch;

    const items = await collectCustomApiSource(
      {
        id: "custom-api-source",
        name: "Custom API",
        type: "custom_api",
        enabled: false,
        url: "https://example.com/api",
        configJson: JSON.stringify({
          itemPath: "items",
          fieldMap: {
            title: "headline",
            url: "link",
            snippet: "summary",
          },
        }),
      },
      fetchImpl,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Mapped Entry");
    expect(items[0]?.snippet).toBe("Mapped summary");
  });

  test("rejects invalid or over-generic mappings", async () => {
    const fetchImpl = ((async () => new Response(JSON.stringify({ items: [] }))) as unknown) as typeof fetch;

    await expect(() =>
      collectCustomApiSource(
        {
          id: "custom-api-source",
          name: "Custom API",
          type: "custom_api",
          enabled: false,
          url: "https://example.com/api",
          configJson: JSON.stringify({
            itemPath: "items",
            fieldMap: {
              title: "headline",
            },
          }),
        },
        fetchImpl,
      ),
    ).toThrow("custom_api fieldMap must include title and url");
  });
});
