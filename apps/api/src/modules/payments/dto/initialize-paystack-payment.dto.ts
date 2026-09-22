import { IsArray, IsEmail, IsOptional, IsString, IsUrl } from "class-validator";

export class InitializePaystackPaymentDto {
  @IsString()
  orderId!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];
}
