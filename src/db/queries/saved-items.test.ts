import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { saveItem, unsaveItem, getSavedItems, isItemSaved } from "./saved-items";

describe("saved-items queries", () => {
  test("saveItem inserts a record", async () => {
    const db = createDb(":memory:");

    await saveItem(db, "item-1", "pack-1");
    const saved = await getSavedItems(db);

    expect(saved).toHaveLength(1);
    expect(saved[0].itemId).toBe("item-1");
    expect(saved[0].packId).toBe("pack-1");
  });

  test("saveItem works without packId", async () => {
    const db = createDb(":memory:");

    await saveItem(db, "item-2");
    const saved = await getSavedItems(db);

    expect(saved).toHaveLength(1);
    expect(saved[0].itemId).toBe("item-2");
    expect(saved[0].packId).toBeNull();
  });

  test("unsaveItem deletes a record", async () => {
    const db = createDb(":memory:");

    await saveItem(db, "item-3");
    expect(await isItemSaved(db, "item-3")).toBe(true);

    await unsaveItem(db, "item-3");
    expect(await isItemSaved(db, "item-3")).toBe(false);
  });

  test("getSavedItems returns items in descending order by saved_at", async () => {
    const db = createDb(":memory:");

    await saveItem(db, "item-1");
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await saveItem(db, "item-2");
    await new Promise((r) => setTimeout(r, 10));
    await saveItem(db, "item-3");

    const saved = await getSavedItems(db);

    expect(saved).toHaveLength(3);
    // Most recent first
    expect(saved[0].itemId).toBe("item-3");
    expect(saved[1].itemId).toBe("item-2");
    expect(saved[2].itemId).toBe("item-1");
  });

  test("getSavedItems respects limit parameter", async () => {
    const db = createDb(":memory:");

    await saveItem(db, "item-1");
    await saveItem(db, "item-2");
    await saveItem(db, "item-3");

    const saved = await getSavedItems(db, 2);

    expect(saved).toHaveLength(2);
  });

  test("isItemSaved returns false for non-existent item", async () => {
    const db = createDb(":memory:");

    const result = await isItemSaved(db, "non-existent");
    expect(result).toBe(false);
  });

  test("isItemSaved returns true for saved item", async () => {
    const db = createDb(":memory:");

    await saveItem(db, "item-1");
    const result = await isItemSaved(db, "item-1");
    expect(result).toBe(true);
  });
});
