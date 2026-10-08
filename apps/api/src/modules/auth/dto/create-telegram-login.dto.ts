import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * The fields Telegram's Login Widget hands back.
 *
 * Nothing here is trusted on arrival: the service recomputes the signature from
 * the bot token, so these only describe the shape of what to verify.
 */
export class SignInTelegramDto {
  @ApiProperty({ description: "Telegram user id" })
  @IsInt()
  @Type(() => Number)
  id!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photo_url?: string;

  @ApiProperty({ description: "Unix seconds, as sent by Telegram" })
  @IsNumber()
  @Type(() => Number)
  auth_date!: number;

  @ApiProperty({ description: "Signature produced with the bot token" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  hash!: string;
}
