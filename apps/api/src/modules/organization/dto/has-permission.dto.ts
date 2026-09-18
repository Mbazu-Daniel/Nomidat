import { IsObject, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class HasPermissionDto {
  @ApiProperty({
    description: "Permission map, e.g. { organization: ['update'], member: ['delete'] }",
    type: "object",
    additionalProperties: { type: "array", items: { type: "string" } },
  })
  @IsObject()
  permissions!: Record<string, string[]>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}
