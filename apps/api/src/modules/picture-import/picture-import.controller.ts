import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { InboundRateLimitGuard } from "../../common/rate-limit/inbound-rate-limit.guard";
import { BusinessAuthService } from "../business/business-auth.service";
import { ExtractPictureDto } from "./dto/extract-picture.dto";
import { PictureImportService } from "./picture-import.service";
import type { PictureFile } from "./types/picture.type";

@Controller("organizations/:organizationId/picture-import")
@UseGuards(InboundRateLimitGuard)
export class PictureImportController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly pictures: PictureImportService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("picture", { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1 } }),
  )
  async extract(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Body() body: ExtractPictureDto,
    @UploadedFile() file?: PictureFile,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId, true, body.purpose);
    return this.pictures.extract(body.purpose, file);
  }
}
