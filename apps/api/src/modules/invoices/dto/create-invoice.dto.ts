import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Max,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateInvoiceItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Decimal, because a shop invoices 1.5 kg. Capped at three places to match the
   * `numeric(12,3)` column: a fourth place would be rounded by Postgres, so a
   * total computed here could disagree with the stored quantity.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Max(999_999_999)
  @Min(0.001)
  quantity!: number;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  unitPriceMinor!: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  discountMinor?: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  taxMinor?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
