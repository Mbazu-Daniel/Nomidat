import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class GetChannelIdentitiesQueryDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}
