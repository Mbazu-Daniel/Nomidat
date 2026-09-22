import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

abstract class ExpenseFieldsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  spentAt?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class CreateExpenseDto extends ExpenseFieldsDto {
  @IsInt()
  @Min(1)
  amountKobo!: number;
}

export class UpdateExpenseDto extends ExpenseFieldsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountKobo?: number;
}
