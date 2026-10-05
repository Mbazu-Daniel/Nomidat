import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class RequestWithdrawalDto {
  @ApiProperty({ description: "Amount in the currency's minor unit." })
  @IsInt()
  @Min(100, { message: "Withdraw at least ₦1." })
  amountMinor!: number;

  @ApiPropertyOptional({ default: "NGN" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
