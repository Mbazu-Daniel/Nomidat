import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Length, Matches, Max, Min } from "class-validator";

export class SetPayoutAccountDto {
  @ApiProperty({ description: "Legal name registered to the bank account." })
  @IsString()
  @Length(2, 120)
  businessName!: string;

  @ApiProperty({ description: "Paystack bank code, from the banks list." })
  @IsString()
  @Length(1, 20)
  bankCode!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  bankName!: string;

  /** Nigerian NUBAN numbers are 10 digits; validated before a network round trip. */
  @ApiProperty({ description: "10-digit NUBAN account number." })
  @IsString()
  @Matches(/^\d{10}$/, { message: "Enter a 10-digit account number." })
  accountNumber!: string;
}

export class SetPayoutFeeDto {
  @ApiProperty({ description: "Platform share in basis points; 100 bps = 1%." })
  @IsInt()
  @Min(0)
  @Max(9_999)
  platformFeeBps!: number;
}
