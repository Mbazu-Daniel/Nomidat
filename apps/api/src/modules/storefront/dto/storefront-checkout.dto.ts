import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { STOREFRONT_PAYMENT_METHODS, type StorefrontPaymentMethod } from "../types/storefront.type";

export class StorefrontCheckoutDto {
  /** The shopper's basket token; also the idempotency key for this order. */
  @IsString()
  @MaxLength(120)
  cartToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  deliveryAddress?: string;

  @IsOptional()
  @IsIn(STOREFRONT_PAYMENT_METHODS)
  paymentMethod?: StorefrontPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentReference?: string;
}

export class AddToCartLineDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cartToken?: string;

  @IsUUID()
  productId!: string;

  /** Omitted for a product with no variants. */
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsInt()
  @Max(999)
  @Min(1)
  quantity!: number;
}
