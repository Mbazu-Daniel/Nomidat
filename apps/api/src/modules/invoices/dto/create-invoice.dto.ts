import { Type } from "class-transformer";
import {
  IsArray,
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
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitPriceKobo!: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discountKobo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  taxKobo?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
