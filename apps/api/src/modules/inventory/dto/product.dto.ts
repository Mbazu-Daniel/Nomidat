import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costMinor?: number;

  /**
   * Opening stock, in the Product's own unit. Three decimal places, matching
   * `stock.on_hand`: a fourth would be rounded by Postgres, so the quantity typed
   * and the quantity stored would disagree.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Max(999_999_999)
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}
