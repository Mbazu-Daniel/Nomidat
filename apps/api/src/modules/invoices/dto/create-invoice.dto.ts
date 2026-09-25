import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Max,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

class CreateInvoiceItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  quantity!: number;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  unitPriceKobo!: number;
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
  discountKobo?: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  taxKobo?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
