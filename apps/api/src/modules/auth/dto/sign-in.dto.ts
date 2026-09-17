import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SignInDto {
  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @IsNotEmpty()
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
