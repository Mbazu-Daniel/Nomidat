import { IsNotEmpty, IsString, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class OrganizationMemberParamsDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;

  @ApiProperty({ description: "Member id, or email for removal" })
  @IsString()
  @IsNotEmpty()
  memberId!: string;
}
