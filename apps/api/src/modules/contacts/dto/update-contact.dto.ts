import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";

/**
 * A partial edit of a contact.
 *
 * Every field is optional, but a field that *is* present must be valid — so an
 * empty `phone` is a mistake the caller sees, while an omitted `phone` leaves
 * the stored number alone. That distinction is why these are not `@IsOptional()`
 * alone: `@IsOptional()` skips validation for `undefined` and `null`, which is
 * what "leave it alone" needs and "clear it" does not.
 */
export class UpdateContactDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 160)
  name?: string;

  /**
   * The WhatsApp and Telegram identity anchor.
   *
   * Trimmed like every other field, and allowed to be cleared by sending an empty
   * string, because a contact whose number is wrong is worse than one with no
   * number: a stale number routes their messages to the wrong conversation.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(["lead", "customer"])
  kind?: "lead" | "customer";
}
