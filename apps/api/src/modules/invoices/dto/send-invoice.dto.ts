import { IsEmail, IsIn, IsOptional, IsUUID } from "class-validator";

export class SendInvoiceDto {
  @IsIn(["email", "telegram", "whatsapp"])
  channel!: "email" | "telegram" | "whatsapp";

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  channelIdentityId?: string;
}
