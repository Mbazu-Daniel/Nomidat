import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Max,
  MaxLength,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

class CreateSaleItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Omitted for a product with no variants. */
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  /**
   * Decimal, because a shop sells 1.5 kg. Capped at three places to match the
   * `numeric(12,3)` column and `stock.on_hand`: a fourth place would be rounded
   * by Postgres, so the stock a sale decrements could disagree with the quantity
   * recorded on the line.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Max(999_999_999)
  @Min(0.001)
  quantity!: number;

  /**
   * An ad-hoc line's price, in minor units. Omit it for a catalogued product: the
   * pricing seam reads the Product's own price, because a caller that supplies a
   * price for a catalogued line supplies a price of its own choosing.
   */
  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  unitPriceMinor?: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  discountMinor?: number;

  /**
   * One code per physical unit, for a product tracked by serial. Must match the
   * line's quantity: a phone sold without its IMEI cannot be traced afterwards.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  serialNumberIds?: string[];
}

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  discountMinor?: number;

  /*
   * There is deliberately no taxMinor field. Tax is the business's own rate, read
   * by the money seam: a caller that could post a tax figure could sell tax free.
   */

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  paymentAmountMinor?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Channel that produced the sale: manual, online or pos. */
  @IsOptional()
  @IsIn(["manual", "online", "pos"])
  source?: "manual" | "online" | "pos";

  /**
   * How the customer receives the order. Set by the POS only.
   *
   * Constrained here, unlike the column, because this DTO is the POS surface and
   * the till is the one caller that has a fixed vocabulary. The storefront and
   * the chat assistant do not send it at all.
   */
  @IsOptional()
  @IsIn(["dine_in", "takeaway", "delivery"])
  fulfilmentType?: "dine_in" | "takeaway" | "delivery";

  @IsOptional()
  @IsString()
  paymentProvider?: string;

  /** Terminal-generated idempotency key; replaying it returns the original sale. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientReference?: string;
}
