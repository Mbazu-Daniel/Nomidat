import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Max,
  IsInt,
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

  @IsOptional()
  @IsString()
  productName?: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  quantity!: number;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  unitPriceKobo!: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  lineTotalKobo?: number;
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
  discountKobo?: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  taxKobo?: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  paymentAmountKobo?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
