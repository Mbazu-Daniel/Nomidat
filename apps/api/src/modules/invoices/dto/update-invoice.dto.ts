import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { CreateInvoiceItemDto } from "./create-invoice.dto";

/**
 * Everything a seller can correct on an invoice that has already been raised.
 *
 * Every field is optional so a partial PATCH means "leave the rest alone", and
 * `null` is allowed on the two fields that hold a value or nothing at all —
 * without it a due date could be set but never taken off again.
 */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /**
   * Replacing the lines is what re-derives the subtotal, so the whole set is
   * sent rather than a patch per line: an invoice's lines are an order, and
   * editing them in place would let a half-written set reach the total.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];

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
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}
