import { describe, expect, it } from "vitest";
import { roundTo, UnitConverter } from "../unit-converter.service";
import { createDbStub } from "../../../common/db/test/db.stub";

/** Feeds the unit list and then the conversion edges, in the order the service reads them. */
function converterStub(units: unknown[], edges: unknown[]) {
  return createDbStub([units, edges]);
}

const KILO = { id: "u-kg", code: "kg", category: "weight", precision: 3 };
const GRAM = { id: "u-g", code: "g", category: "weight", precision: 0 };
const POUND = { id: "u-lb", code: "lb", category: "weight", precision: 3 };
const PIECE = { id: "u-pcs", code: "pcs", category: "count", precision: 0 };

describe("unit conversion", () => {
  it("converts directly when a factor is defined", async () => {
    const { db } = converterStub(
      [KILO, GRAM],
      [{ fromUnitOfMeasureId: "u-kg", toUnitOfMeasureId: "u-g", factor: 1000 }],
    );

    expect(await new UnitConverter(db).convert("shop", 2, "kg", "g")).toBe(2000);
  });

  it("follows a chain when no direct factor exists", async () => {
    const { db } = converterStub(
      [KILO, GRAM, POUND],
      [
        { fromUnitOfMeasureId: "u-kg", toUnitOfMeasureId: "u-g", factor: 1000 },
        { fromUnitOfMeasureId: "u-g", toUnitOfMeasureId: "u-lb", factor: 0.00220462 },
      ],
    );

    // 2 kg -> 2000 g -> 2000 * 0.00220462, rounded to lb's 3 decimals.
    const result = await new UnitConverter(db).convert("shop", 2, "kg", "lb");
    expect(result).toBe(4.409);
  });

  it("returns the quantity untouched when the unit is unchanged", async () => {
    const { db } = converterStub([KILO], []);
    expect(await new UnitConverter(db).convert("shop", 1.5, "kg", "kg")).toBe(1.5);
  });

  it("refuses to convert between different measures", async () => {
    const { db } = converterStub([KILO, PIECE], []);

    await expect(new UnitConverter(db).convert("shop", 1, "kg", "pcs")).rejects.toThrow(
      /different measures/,
    );
  });

  it("explains when no conversion path exists rather than guessing", async () => {
    const { db } = converterStub([KILO, POUND], []);

    await expect(new UnitConverter(db).convert("shop", 1, "kg", "lb")).rejects.toThrow(
      /No conversion path/,
    );
  });

  it("rejects an unknown unit code", async () => {
    const { db } = converterStub([KILO], []);
    await expect(new UnitConverter(db).convert("shop", 1, "bananas", "kg")).rejects.toThrow(
      /Unknown unit/,
    );
  });
});

describe("roundTo", () => {
  it("keeps only the precision the unit is quoted in", () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
    expect(roundTo(1.5, 0)).toBe(2);
  });
});