import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateUnitOfMeasureDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(20)
  @Matches(/^[a-z0-9_]+$/, { message: "Unit code may contain lowercase letters, digits and _" })
  code!: string;

  @IsIn(["count", "weight", "volume", "length"])
  category!: "count" | "weight" | "volume" | "length";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  precision?: number;
}

export class UpdateUnitOfMeasureDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  precision?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateUnitConversionDto {
  @IsUUID()
  fromUnitOfMeasureId!: string;

  @IsUUID()
  toUnitOfMeasureId!: string;

  @IsNumber({ maxDecimalPlaces: 10 })
  @IsPositive()
  factor!: number;
}

export class CreateProductCategoryDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: "Slug may contain lowercase letters, digits and -" })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignProductToCategoriesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  @Type(() => String)
  categoryIds!: string[];
}

export class CreateSupplierDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
