import { IsNotEmpty, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class OrganizationIdParamDto {
  @ApiProperty({ description: "Organization ID" })
  @IsUUID()
  @IsNotEmpty()
  organizationId!: string;
}
