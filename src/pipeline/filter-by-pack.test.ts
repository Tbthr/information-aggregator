import { describe, expect, test } from "bun:test";
import { filterByPack } from "./filter-by-topic";
import type { FilterContext } from "../types/index";

interface TestItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
}

function makeItem(title: string, summary: string, content: string): TestItem {
  return { normalizedTitle: title, normalizedSummary: summary, normalizedContent: content };
}

describe("filterByPack", () => {
  describe("exclude logic (OR semantics)", () => {
    test("excludes item when title matches exclude keyword", () => {
      const item = makeItem("apple product launch", "summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple"] };
      expect(filterByPack(item, context)).toBe(false);
    });

    test("excludes item when summary matches exclude keyword", () => {
      const item = makeItem("product launch", "banana smoothie recipe", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["banana"] };
      expect(filterByPack(item, context)).toBe(false);
    });

    test("excludes item when content matches exclude keyword", () => {
      const item = makeItem("product launch", "summary", "cherry dessert idea");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["cherry"] };
      expect(filterByPack(item, context)).toBe(false);
    });

    test("excludes item when any exclude keyword matches (OR)", () => {
      const item = makeItem("product launch", "orange summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple", "orange", "banana"] };
      expect(filterByPack(item, context)).toBe(false);
    });

    test("passes when no exclude keywords match", () => {
      const item = makeItem("product launch", "grape summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple", "banana"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("case insensitive matching for exclude", () => {
      const item = makeItem("APPLE product launch", "summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple"] };
      expect(filterByPack(item, context)).toBe(false);
    });
  });

  describe("mustInclude logic (OR semantics)", () => {
    test("passes when mustInclude keyword found in title", () => {
      const item = makeItem("apple product announcement", "summary", "content");
      const context: FilterContext = { topicIds: ["p1"], mustInclude: ["apple"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("passes when mustInclude keyword found in summary", () => {
      const item = makeItem("product announcement", "banana is great", "content");
      const context: FilterContext = { topicIds: ["p1"], mustInclude: ["banana"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("passes when mustInclude keyword found in content", () => {
      const item = makeItem("product announcement", "summary", "cherry is delicious");
      const context: FilterContext = { topicIds: ["p1"], mustInclude: ["cherry"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("passes when any mustInclude keyword matches (OR)", () => {
      const item = makeItem("product announcement", "grape summary", "content");
      const context: FilterContext = { topicIds: ["p1"], mustInclude: ["apple", "grape", "banana"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("fails when no mustInclude keywords match", () => {
      const item = makeItem("product announcement", "grape summary", "content");
      const context: FilterContext = { topicIds: ["p1"], mustInclude: ["apple", "banana"] };
      expect(filterByPack(item, context)).toBe(false);
    });

    test("case insensitive matching for mustInclude", () => {
      const item = makeItem("APPLE PRODUCT", "summary", "content");
      const context: FilterContext = { topicIds: ["p1"], mustInclude: ["apple"] };
      expect(filterByPack(item, context)).toBe(true);
    });
  });

  describe("combined exclude and mustInclude", () => {
    test("exclude checked first, mustInclude second", () => {
      const item = makeItem("apple product", "grape summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple"], mustInclude: ["grape"] };
      // exclude wins - item filtered out
      expect(filterByPack(item, context)).toBe(false);
    });

    test("passes when not excluded and mustInclude satisfied", () => {
      const item = makeItem("banana product", "grape summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple"], mustInclude: ["grape"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("fails when not excluded but mustInclude not satisfied", () => {
      const item = makeItem("banana product", "grape summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple"], mustInclude: ["cherry"] };
      expect(filterByPack(item, context)).toBe(false);
    });
  });

  describe("default behavior", () => {
    test("passes when mustInclude not configured", () => {
      const item = makeItem("any title", "any summary", "any content");
      const context: FilterContext = { topicIds: ["p1"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("passes when only exclude configured and not matched", () => {
      const item = makeItem("banana product", "grape summary", "content");
      const context: FilterContext = { topicIds: ["p1"], exclude: ["apple"] };
      expect(filterByPack(item, context)).toBe(true);
    });

    test("empty exclude and mustInclude arrays", () => {
      const item = makeItem("any title", "any summary", "any content");
      const context: FilterContext = { topicIds: ["p1"], exclude: [], mustInclude: [] };
      expect(filterByPack(item, context)).toBe(true);
    });
  });
});
