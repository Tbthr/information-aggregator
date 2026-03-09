import { describe, expect, test } from "bun:test";
import { parseHnItems } from "./hn";

describe("parseHnItems", () => {
  test("maps hacker news api items into raw items", () => {
    const items = parseHnItems(
      [
        { id: 1, title: "Show HN: Demo", url: "https://example.com/demo", by: "alice", time: 1700000000 },
      ],
      "hn-top",
    );

    expect(items[0]?.sourceId).toBe("hn-top");
    expect(items[0]?.title).toBe("Show HN: Demo");
    expect(items[0]?.author).toBe("alice");
  });
});
