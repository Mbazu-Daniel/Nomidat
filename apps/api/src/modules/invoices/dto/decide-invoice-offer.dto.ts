import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { NEGOTIATION_DECISIONS } from "../invoice-negotiation.constants";

export class DecideInvoiceOfferDto {
  @ApiProperty({ enum: NEGOTIATION_DECISIONS })
  @IsIn(NEGOTIATION_DECISIONS, { message: "Choose accept or decline." })
  decision!: (typeof NEGOTIATION_DECISIONS)[number];
}
