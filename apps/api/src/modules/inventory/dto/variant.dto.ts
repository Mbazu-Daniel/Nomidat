import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateVariantDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  costMinor?: number;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  priceMinor?: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  costMinor?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
