import { IsString, Matches, MaxLength } from "class-validator";

export class UpdatePaymentKeyDto {
  @IsString()
  @Matches(/^sk_(test|live)_[A-Za-z0-9]+$/)
  @MaxLength(200)
  secretKey!: string;
}
