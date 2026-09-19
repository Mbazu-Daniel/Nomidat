import { describe, expect, it } from "vitest";
import { DEFAULT_EXPENSE_CATEGORIES } from "../expense-categories";

describe("DEFAULT_EXPENSE_CATEGORIES", () => {
  it("seeds fifty categories", () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(50);
  });

  it("uses unique non-empty names", () => {
    const names = DEFAULT_EXPENSE_CATEGORIES.map((category) => category.name.trim());
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("describes every category", () => {
    for (const category of DEFAULT_EXPENSE_CATEGORIES) {
      expect(category.description.trim().length).toBeGreaterThan(0);
    }
  });
});
