import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, MaxLength } from "class-validator";

/**
 * A partial edit of an expense category.
 *
 * Every field is optional so a rename does not have to restate the description,
 * but a field that *is* present must be usable: the name is trimmed and cannot
 * collapse to empty, because a blank name would reach every expense form that
 * offers this category. `@IsOptional()` skips `undefined` and `null`, which is
 * exactly what "leave it alone" needs.
 */
export class UpdateExpenseCategoryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  description?: string;
}
