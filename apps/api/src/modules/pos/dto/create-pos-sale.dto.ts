import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class PosSaleLineDto {
  @IsUUID()
  productId!: string;

  /**
   * Omitted for a product with no variants. A variant is its own Stock Level, so
   * a sale that names one must decrement that variant rather than the product.
   */
  @IsOptional()
  @IsUUID()
  variantId?: string;

  /**
   * Decimal, because a till weighs produce: 1.5 kg of mangos is one sale.
   *
   * Capped at three places to match `order_item.quantity` and `stock.on_hand`.
   * The cap is in the DTO rather than left to the column, because Postgres
   * *rounds* a fourth place instead of refusing it — the stored quantity would
   * then disagree with the line total the cashier was shown.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Max(999_999_999)
  @Min(0.001)
  quantity!: number;

  /**
   * The exact units being sold, for a product tracked by serial. One per unit:
   * a serial is one physical item, so a serialised line is always one long, and
   * its quantity stays whole.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  serialNumberIds?: string[];
}

/**
 * Deliberately excludes totals, tax and change: the terminal sends what the
 * customer handed over, and the server derives every money figure itself.
 */
export class CreatePosSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PosSaleLineDto)
  items!: PosSaleLineDto[];

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  discountMinor?: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  tenderedMinor?: number;

  @IsOptional()
  @IsIn(["cash", "bank_transfer", "card"])
  paymentMethod?: "cash" | "bank_transfer" | "card";

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Idempotency key minted by the terminal; a replay returns the original sale. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientReference?: string;
}
