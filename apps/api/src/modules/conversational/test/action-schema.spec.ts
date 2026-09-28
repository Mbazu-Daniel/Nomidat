import { describe, expect, it } from "vitest";
import { parsedActionSchema } from "../action-schema";

describe("AI action boundary", () => {
  it("rejects invented tool names and injected tenant overrides", () => {
    expect(parsedActionSchema.safeParse({ intent: "delete_all" }).success).toBe(false);
    expect(
      parsedActionSchema.safeParse({ intent: "summary", organizationId: "another-tenant" }).success,
    ).toBe(false);
  });
  it("rejects negative money, fractional units and impossible calendar dates", () => {
    expect(parsedActionSchema.safeParse({ intent: "record_sale", quantity: 1.5 }).success).toBe(
      false,
    );
    expect(
      parsedActionSchema.safeParse({ intent: "record_expense", amountNaira: -1 }).success,
    ).toBe(false);
    expect(
      parsedActionSchema.safeParse({ intent: "record_expense", date: "2026-02-30" }).success,
    ).toBe(false);
  });
});
