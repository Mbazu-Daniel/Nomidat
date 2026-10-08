import { describe, expect, it } from "vitest";
import { ValidationPipe } from "@nestjs/common";
import { CreatePosSaleDto } from "../src/modules/pos/dto/create-pos-sale.dto";

/**
 * The quantity a till may send, checked through the same pipe the API uses.
 *
 * `order_item.quantity` and `stock.on_hand` are `numeric(12,3)` so a shop can sell
 * 1.5 kg. This DTO was the last place that refused it: `@IsInt()` on the line
 * quantity meant a weighed sale was rejected with a 400 before it ever reached
 * the column. Validated through `ValidationPipe` rather than by calling the
 * decorators directly, because the pipe is what runs in production — including
 * `transform`, which is what turns a posted `"1.5"` into a number.
 */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
// Version 4, because a serialised line names its units with @IsUUID("4") and the
// product itself must be a real identifier too — a "1" here fails validation for
// the wrong reason and hides what the quantity tests are about.
const PRODUCT = "11111111-1111-4111-8111-111111111111";

function saleWith(quantity: unknown) {
  return { items: [{ productId: PRODUCT, quantity }] };
}

describe("a till's line quantity", () => {
  it("acceptsAFractionalQuantity", async () => {
    // The case this exists for: 1.5 kg of mangos is one sale.
    const dto = await pipe.transform(saleWith(1.5), { type: "body", metatype: CreatePosSaleDto });
    expect(dto.items[0].quantity).toBe(1.5);
  });

  it("acceptsASmallestRecordableQuantity", async () => {
    const dto = await pipe.transform(saleWith(0.001), { type: "body", metatype: CreatePosSaleDto });
    expect(dto.items[0].quantity).toBe(0.001);
  });

  it("acceptsAWholeQuantity", async () => {
    const dto = await pipe.transform(saleWith(3), { type: "body", metatype: CreatePosSaleDto });
    expect(dto.items[0].quantity).toBe(3);
  });

  it("acceptsAFractionPostedAsText", async () => {
    // A till sending form-encoded JSON posts "1.5"; without `transform` this
    // would reach the arithmetic as a string.
    const dto = await pipe.transform(saleWith("1.5"), {
      type: "body",
      metatype: CreatePosSaleDto,
    });
    expect(dto.items[0].quantity).toBe(1.5);
  });

  it("refusesAQuantityOfNothing", async () => {
    await expect(
      pipe.transform(saleWith(0), { type: "body", metatype: CreatePosSaleDto }),
    ).rejects.toThrow();
  });

  it("refusesANegativeQuantity", async () => {
    // A negative line would return stock while still recording money owed.
    await expect(
      pipe.transform(saleWith(-2), { type: "body", metatype: CreatePosSaleDto }),
    ).rejects.toThrow();
  });

  it("refusesAFourthDecimalPlace", async () => {
    // Postgres would round this, so the stored quantity would disagree with the
    // line total the cashier agreed to. The DTO is where that has to stop.
    await expect(
      pipe.transform(saleWith(1.0005), { type: "body", metatype: CreatePosSaleDto }),
    ).rejects.toThrow();
  });

  it("refusesAQuantityTheColumnCannotHold", async () => {
    // numeric(12,3) leaves nine whole digits.
    await expect(
      pipe.transform(saleWith(1e10), { type: "body", metatype: CreatePosSaleDto }),
    ).rejects.toThrow();
  });
});
