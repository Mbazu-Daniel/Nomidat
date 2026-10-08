import { IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * The name and face a person shows inside one business.
 *
 * Deliberately separate from the user record: the same login can be the owner of
 * one shop and a clerk at another, and each business wants to see its own name.
 */
export class SaveMemberProfileDto {
  @ApiProperty({ example: "Ada" })
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @ApiPropertyOptional({ example: "Bello" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ description: "Data URL of an uploaded image" })
  @IsOptional()
  @IsString()
  @MaxLength(65000)
  avatar?: string | null;
}
