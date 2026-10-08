import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateBatchDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: "Lot or batch code, unique within the business" })
  @IsString()
  @MaxLength(80)
  code!: string;

  /**
   * Decimal, because a shop receives 1.5 kg. Capped at three places to match the
   * `numeric(15,3)` columns: a fourth place would be silently rounded by Postgres,
   * so the quantity received and the stock it books in would disagree.
   */
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConsumeBatchDto {
  /** Same three-place cap as `CreateBatchDto`, for the same reason. */
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: ["outbound_ship", "adjustment_remove"] })
  @IsOptional()
  @IsIn(["outbound_ship", "adjustment_remove"])
  type?: "outbound_ship" | "adjustment_remove";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
