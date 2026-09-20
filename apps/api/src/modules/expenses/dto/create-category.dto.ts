import { IsOptional, IsString } from "class-validator";

export class CreateExpenseCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
