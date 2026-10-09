import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RejectWithdrawalDto {
  /** Shown to the seller, so it says why the money is not going out. */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  reason!: string;
}
