import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class SocialIdTokenDto {
  @ApiProperty({ description: "Google ID token" })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({ description: "Google access token" })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nonce?: string;
}

export class SignInSocialDto {
  @ApiProperty({ enum: ["google"], example: "google" })
  @IsIn(["google"])
  provider!: "google";

  @ApiPropertyOptional({
    description: "Where to redirect after a successful OAuth flow",
    example: "http://localhost:3000",
  })
  @IsOptional()
  @IsString()
  callbackURL?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  newUserCallbackURL?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  errorCallbackURL?: string;

  @ApiPropertyOptional({
    description: "When set, signs in directly with no OAuth redirect",
    type: SocialIdTokenDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialIdTokenDto)
  idToken?: SocialIdTokenDto;

  @ApiPropertyOptional({ type: [String] })
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
  @IsBoolean()
  requestSignUp?: boolean;

  @ApiPropertyOptional({
    description: "Extra OAuth query params (e.g. { hd: 'example.com' })",
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsObject()
  additionalParams?: Record<string, string>;
}
