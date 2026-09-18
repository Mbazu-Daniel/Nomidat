import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateTelegramMiniAppSessionDto {
  @ApiProperty({ description: "Raw Telegram WebApp initData string" })
  @IsString()
  @MinLength(1)
  initData!: string;
}
