import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { WEBHOOK_EVENTS } from "../engagement.constants";

export class CreateOutboundWebhookDto {
  @ApiProperty({ description: "Must be a public https endpoint." })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  events!: string[];

  @ApiPropertyOptional({ description: "A label to help the team recognise this endpoint." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
