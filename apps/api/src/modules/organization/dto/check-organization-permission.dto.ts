import { IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CheckOrganizationPermissionDto {
  @ApiProperty({
    description: "Permission map, e.g. { organization: ['update'], member: ['delete'] }",
    type: "object",
    additionalProperties: { type: "array", items: { type: "string" } },
  })
  @IsObject()
  permissions!: Record<string, string[]>;
}
