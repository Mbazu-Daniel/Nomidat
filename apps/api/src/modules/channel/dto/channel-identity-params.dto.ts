import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ChannelIdentityParamsDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;

  @ApiProperty()
  @IsUUID()
  channelIdentityId!: string;
}
