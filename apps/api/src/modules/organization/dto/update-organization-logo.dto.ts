import { IsOptional, Matches, ValidateIf } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateOrganizationLogoDto {
  /**
   * The bucket key returned by `POST /files/upload-url`, or null to remove the
   * logo.
   *
   * Constrained to the `organization-logos` location and to a UUID-prefixed path.
   * That catches a malformed key; the service separately checks the prefix
   * against the organization the caller was authorized for, which is what stops
   * a well-formed key belonging to a different business.
   */
  @ApiPropertyOptional({
    description: "Bucket key from POST /files/upload-url, or null to remove the logo",
  })
  @IsOptional()
  @ValidateIf((_value, address) => address !== null)
  @Matches(/^[0-9a-f-]{36}\/organization-logos\//, {
    message: "logoKey must be an organization-logo key from this organization",
  })
  logoKey!: string | null;
}
