import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import { BusinessAuthService } from "../business/business-auth.service";
import { ContactsService } from "./contacts.service";
import { CreateContactDto, CreateNoteDto } from "./dto";

@ApiTags("Contacts")
@Controller("organizations/:organizationId/contacts")
export class ContactsController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly contacts: ContactsService,
  ) {}

  @Get()
  async getContacts(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Query("offset", new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.getContacts(org, offset);
  }

  @Post()
  async createContact(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Body() body: CreateContactDto,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.createContact(org, body);
  }

  @Get(":contactId")
  async getClientFolder(
    @Param("organizationId") org: string,
    @Param("contactId", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.getClientFolder(org, id);
  }

  @Post(":contactId/convert")
  async updateCustomer(
    @Param("organizationId") org: string,
    @Param("contactId", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.updateCustomer(org, id);
  }

  @Post(":contactId/notes")
  async createNote(
    @Param("organizationId") org: string,
    @Param("contactId", ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Body() body: CreateNoteDto,
  ) {
    const session = await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.createNote(org, id, session.userId, body);
  }
}
