import { Type } from "class-transformer";
import { IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class UpdateOrganizationDataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ApiPropertyOptional({ type: "object", additionalProperties: true, nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class UpdateOrganizationDto {
  @ApiProperty({ type: UpdateOrganizationDataDto })
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateOrganizationDataDto)
  data!: UpdateOrganizationDataDto;
}
