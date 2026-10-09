import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "../files.constants";
import { FileLocation } from "../types/file-location.type";

/**
 * The shape of an upload request. Everything here is attacker-controlled, which
 * is why the content type is an allowlist and the size is required rather than
 * optional: both end up baked into the presigned URL, so a value we refuse here
 * is a capability the caller never receives.
 */
export class GenerateUploadUrlDto {
  @ApiProperty({ enum: FileLocation, description: "Namespace the object is stored under." })
  @IsIn(Object.values(FileLocation))
  location!: FileLocation;

  @ApiProperty({ description: "Original file name, used as the key's last segment." })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ enum: ALLOWED_UPLOAD_CONTENT_TYPES })
  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES)
  contentType!: (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

  @ApiProperty({ maximum: MAX_UPLOAD_BYTES, description: "Byte length, enforced by R2." })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  contentLength!: number;
}
