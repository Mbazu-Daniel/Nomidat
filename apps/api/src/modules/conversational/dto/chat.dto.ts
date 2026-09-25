import { IsBoolean, IsString, IsUUID, Length } from "class-validator";

export class CreateChatDto {
  @IsString()
  @Length(1, 4000)
  text!: string;
}

export class ConfirmActionDto {
  @IsUUID()
  messageId!: string;

  @IsBoolean()
  confirm!: boolean;
}
