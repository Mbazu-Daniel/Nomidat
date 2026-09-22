import { IsInt, IsOptional, IsString } from "class-validator";

export class AdjustStockDto {
  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
