import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { StorefrontDomainKind } from "../types/storefront.type";

export class AddDomainDto {
  @IsString()
  @MaxLength(253)
  hostname!: string;

  @IsOptional()
  @IsIn([StorefrontDomainKind.SUBDOMAIN, StorefrontDomainKind.CUSTOM])
  kind?: StorefrontDomainKind;
}
