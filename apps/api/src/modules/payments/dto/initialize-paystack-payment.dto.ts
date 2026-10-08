import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, IsUrl } from "class-validator";

/**
 * Channels Paystack accepts. Whitelisted rather than free-form: this array is
 * passed straight through to `/transaction/initialize`, and an unvalidated string
 * would let a caller request a channel we have no handling for.
 */
const PAYSTACK_CHANNELS = ["card", "bank", "ussd", "mobile_money"] as const;

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
  @ArrayMaxSize(PAYSTACK_CHANNELS.length)
  @IsIn(PAYSTACK_CHANNELS, { each: true })
  channels?: (typeof PAYSTACK_CHANNELS)[number][];
}
