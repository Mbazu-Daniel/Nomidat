import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { SocialIdTokenDto } from "./sign-in-social.dto";

export class LinkSocialDto {
  @ApiProperty({ enum: ["google"], example: "google" })
  @IsIn(["google"])
  provider!: "google";

  @ApiPropertyOptional({
    description: "Where to redirect after linking completes",
    example: "http://localhost:3000",
  })
  @IsOptional()
  @IsString()
  callbackURL?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  errorCallbackURL?: string;

  @ApiPropertyOptional({ type: SocialIdTokenDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialIdTokenDto)
  idToken?: SocialIdTokenDto;

  @ApiPropertyOptional({
    description: "Additional Google scopes to request (e.g. Drive)",
    type: [String],
    example: ["https://www.googleapis.com/auth/drive.file"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disableRedirect?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  additionalParams?: Record<string, string>;
}
