import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateOrganizationDto {
  @ApiProperty({ example: "My Organization" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "my-org" })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiPropertyOptional({ example: "https://example.com/logo.png" })
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Keep the current active organization after create",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  keepCurrentActiveOrganization?: boolean;
}
