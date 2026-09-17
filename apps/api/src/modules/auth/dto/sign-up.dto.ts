import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SignUpDto {
  @ApiPropertyOptional({ example: "John Doe" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: "john@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: "https://example.com/avatar.png" })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callbackURL?: string;
}
