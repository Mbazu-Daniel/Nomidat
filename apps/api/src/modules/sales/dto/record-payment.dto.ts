import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amountKobo!: number;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
