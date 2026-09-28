import { UseGuards } from "@nestjs/common";
import { InboundRateLimitGuard } from "../../common/rate-limit/inbound-rate-limit.guard";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { BusinessAuthService } from "../business/business-auth.service";
import { extractHeaders } from "../../common/helpers/auth-http";
import { ConversationalService } from "./conversational.service";
import { AiService } from "./ai.service";
import { CreateChatDto, ConfirmActionDto } from "./dto";

@Controller("organizations/:organizationId/chat")
@UseGuards(InboundRateLimitGuard)
export class ConversationalController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly chat: ConversationalService,
    private readonly ai: AiService,
  ) {}

  @Get()
  async getMessages(@Param("organizationId") organizationId: string, @Req() req: Request) {
    const actor = await this.auth.getSession(extractHeaders(req), organizationId);
    return this.chat.getMessages({ ...actor, organizationId });
  }

  @Post()
  async createMessage(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Body() body: CreateChatDto,
  ) {
    const actor = await this.auth.getSession(extractHeaders(req), organizationId);
    return this.chat.createMessage({ ...actor, organizationId }, body.text);
  }

  @Post("confirmation")
  async updateConfirmation(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Body() body: ConfirmActionDto,
  ) {
    const actor = await this.auth.getSession(extractHeaders(req), organizationId);
    return this.chat.updateConfirmation({ ...actor, organizationId }, body.messageId, body.confirm);
  }

  @Post("voice")
  @UseInterceptors(FileInterceptor("audio", { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  async createTranscript(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
  ) {
    await this.auth.getSession(extractHeaders(req), organizationId);
    if (
      !file ||
      !["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"].includes(
        file.mimetype.split(";")[0],
      )
    ) {
      throw new BadRequestException("Upload an audio recording of at most 10 MB.");
    }
    const text = await this.ai.createTranscript(file.buffer, file.mimetype);
    return { text };
  }
}
