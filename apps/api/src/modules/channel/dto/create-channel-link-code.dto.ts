import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateChannelLinkCodeDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}
