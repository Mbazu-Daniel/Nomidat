import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { STOREFRONT_TEMPLATES } from "@nomidat/db/schema";

export class UpdateStorefrontSettingsDto {
  @ApiPropertyOptional({ description: "Makes the shop publicly reachable." })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ enum: STOREFRONT_TEMPLATES })
  @IsOptional()
  @IsIn(STOREFRONT_TEMPLATES)
  template?: string;

  @ApiPropertyOptional({ description: "Colour tokens; unknown keys are dropped." })
  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Extra stylesheet, sanitised before storage." })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  customCss?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  seo?: Record<string, unknown>;
}
