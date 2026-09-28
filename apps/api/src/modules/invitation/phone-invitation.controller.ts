import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { PhoneInvitationDto } from "./dto/phone-invitation.dto";
import { PhoneInvitationService } from "./phone-invitation.service";

@Controller()
export class PhoneInvitationController {
  constructor(private readonly service: PhoneInvitationService) {}
  @Post("organizations/:org/phone-invitations")
  create(
    @Param("org", ParseUUIDPipe) org: string,
    @Body() body: PhoneInvitationDto,
    @Req() req: Request,
  ) {
    return this.service.create(extractHeaders(req), org, body);
  }
  @Get("organizations/:org/phone-invitations")
  list(@Param("org", ParseUUIDPipe) org: string, @Req() req: Request) {
    return this.service.list(extractHeaders(req), org);
  }
  @Post("organizations/:org/phone-invitations/:id/cancel")
  cancel(
    @Param("org", ParseUUIDPipe) org: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.cancel(extractHeaders(req), org, id);
  }
  @Get("phone-invitations")
  inbox(@Req() req: Request) {
    return this.service.inbox(extractHeaders(req));
  }
  @Post("phone-invitations/:id/accept")
  accept(@Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.respond(extractHeaders(req), id, true);
  }
  @Post("phone-invitations/:id/reject")
  reject(@Param("id", ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.respond(extractHeaders(req), id, false);
  }
}
