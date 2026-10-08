import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { MAX_NEGOTIATION_MESSAGE_LENGTH } from "../invoice-negotiation.constants";

/** Submitted by anyone holding a share link, so every field is tightly bounded. */
export class ProposeInvoiceOfferDto {
  @ApiProperty({ description: "The amount being offered, in the currency's minor unit." })
  @Type(() => Number)
  @IsInt({ message: "Enter a whole amount." })
  @Min(1, { message: "Enter an amount greater than zero." })
  proposedTotalMinor!: number;

  @ApiPropertyOptional({ maxLength: MAX_NEGOTIATION_MESSAGE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NEGOTIATION_MESSAGE_LENGTH)
  message?: string;
}
