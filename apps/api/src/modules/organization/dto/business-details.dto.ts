import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class BusinessDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ownerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  shopNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;
}
