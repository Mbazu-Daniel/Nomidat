import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

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
  /**
   * The bucket key of the product's picture, exactly as returned by
   * `POST /files/upload-url`.
   *
   * A key rather than a URL, so the public hostname stays a deployment setting.
   * Validated as belonging to this organization's own namespace, because the
   * alternative is a product in one business rendering another business's image.
   * A null clears the picture; omitted leaves it alone.
   */
  @IsOptional()
  @ValidateIf((_value, address) => address !== null)
  @Matches(/^[0-9a-f-]{36}\/product-images\//, {
    message:
      "imageKey must be a key from this organization, of the form {organizationId}/{location}/{unique}-{fileName}",
  })
  imageKey?: string | null;

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
