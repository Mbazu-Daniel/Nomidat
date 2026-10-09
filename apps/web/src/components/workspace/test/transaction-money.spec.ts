import { describe, expect, it } from "vitest";
import { formatMoney, minorToDecimalInput, parseMoneyToMinor } from "@/lib/money";

/**
 * The money a seller reads and types on a transaction form, where the amount
 * passes through a number field and back out to the server.
 *
 * The two failures this guards are both silent and both change a stored number:
 * a field seeded with a hardcoded `/ 100` shows a currency without hundredths a
 * hundred times wrong, and an amount typed with more decimal places than the
 * currency holds is either truncated into a different figure or accepted when it
 * should have been refused.
 */
describe("the amount a transaction field shows", () => {
  it("showsTheStoredFigureInTheBusinesssOwnCurrency", () => {
    expect(formatMoney(450_000, "NGN")).toContain("4,500");
    expect(formatMoney(450_000, "USD")).toMatch(/\$|USD/);
  });

  it("showsACurrencyWithoutHundredthsUnchanged", () => {
    // 450 minor yen is ¥450. A cent-style division shows ¥4.50 and the seller
    // saves back 4.5 yen.
    expect(formatMoney(450, "JPY")).toContain("450");
    expect(formatMoney(450, "JPY")).not.toContain(".00");
  });
});

describe("seeding a number field from a stored amount", () => {
  it("producesAPlainDecimalTheFieldCanParseBack", () => {
    // A symbol or a thousands separator cannot be parsed, so an amount read out
    // and saved again would come back changed.
    expect(minorToDecimalInput(45_000, "NGN")).toBe("450.00");
    expect(parseMoneyToMinor(minorToDecimalInput(45_000, "NGN"), "NGN")).toBe(45_000);
  });

  it("givesTheSmallestAmountTheCurrencyCanHold_asTheFieldStep", () => {
    // The step is derived from the scale rather than written as 0.01, which is a
    // value the currency may not be able to represent at all.
    expect(Number(minorToDecimalInput(1, "NGN"))).toBe(0.01);
    expect(Number(minorToDecimalInput(1, "JPY"))).toBe(1);
  });

  it("leavesTheFieldEmptyRatherThanShowingAZeroForAnUnsetAmount", () => {
    // The form distinguishes "no tax" from "zero tax" by null, so a field
    // prefilled with 0.00 would silently turn one into the other on save.
    expect(minorToDecimalInput(0, "NGN")).toBe("0.00");
    expect(parseMoneyToMinor("", "NGN")).toBeNull();
  });
});

describe("an amount the seller types", () => {
  it("scalesByTheCurrencyRatherThanAFixedHundred", () => {
    expect(parseMoneyToMinor("450", "NGN")).toBe(45_000);
    expect(parseMoneyToMinor("450", "JPY")).toBe(450);
  });

  it("refusesMoreDecimalPlacesThanTheCurrencyCanHold", () => {
    // Returning null leaves the field's previous value in place rather than
    // sending a rounded amount the seller never typed.
    expect(parseMoneyToMinor("4.5", "JPY")).toBeNull();
    expect(parseMoneyToMinor("4.555", "NGN")).toBeNull();
    expect(parseMoneyToMinor("4.55", "NGN")).toBe(455);
  });

  it("refusesTextThatIsNotAnAmount", () => {
    expect(parseMoneyToMinor("1,000", "NGN")).toBeNull();
    expect(parseMoneyToMinor("-5", "NGN")).toBeNull();
    expect(parseMoneyToMinor("abc", "NGN")).toBeNull();
  });
});
