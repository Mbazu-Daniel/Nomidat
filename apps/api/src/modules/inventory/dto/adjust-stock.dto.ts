import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class AdjustStockDto {
  /**
   * Decimal, because a shop sells 1.5 kg. Capped at three places to match the
   * `numeric(15,3)` columns: a fourth place would be silently rounded by Postgres,
   * so the quantity asked for and the ledger row written would disagree.
   */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Max(999_999_999)
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
