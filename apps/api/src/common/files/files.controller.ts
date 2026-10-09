import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { OrganizationAuthService } from "../../modules/organization-summary/organization-auth.service";
import { authorizeOrganization } from "../helpers/organization-auth";
import { GenerateUploadUrlDto } from "./dto/generate-upload-url.dto";
import { FileStorageService } from "./file-storage.service";

@ApiTags("Files")
@Controller("organizations/:organizationId/files")
export class FilesController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly files: FileStorageService,
  ) {}

  @Post("upload-url")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate a presigned upload URL for R2",
    description:
      "The bytes are PUT straight to the returned URL; they never pass through the API. " +
      "Persist the returned fileKey against the record that owns the image.",
  })
  async generateUploadUrl(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Body() body: GenerateUploadUrlDto,
  ) {
    // Read permission, not write: attaching a photo to an existing product is not
    // a change to the books, and a seller stocking a catalogue should not need
    // to hold settings access to put a picture on an item.
    await authorizeOrganization(this.auth, req, organizationId, "inventory");
    return this.files.generateUploadUrl({
      organizationId,
      location: body.location,
      fileName: body.fileName,
      contentType: body.contentType,
      contentLength: body.contentLength,
    });
  }
}
