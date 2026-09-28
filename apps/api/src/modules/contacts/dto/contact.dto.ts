import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

export class CreateContactDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsIn(["lead", "customer"])
  kind!: "lead" | "customer";
}

export class CreateNoteDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 4000)
  body!: string;
}
