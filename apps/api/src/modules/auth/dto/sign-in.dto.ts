import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SignInDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @IsNotEmpty()
  // Bounded because a hash is Argon2id at 64 MB per call: an unbounded body
  // lets one request buy a minute of CPU by sending a megabyte of password.
  @MaxLength(256)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callbackURL?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
