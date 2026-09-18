import { IsOptional, IsString, ValidateIf } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class SetActiveOrganizationDto {
  @ApiPropertyOptional({
    description: "Organization ID to activate, or null to unset",
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  organizationId?: string | null;

  @ApiPropertyOptional({ description: "Organization slug to activate" })
  @IsOptional()
  @IsString()
  organizationSlug?: string;
}
