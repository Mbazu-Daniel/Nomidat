import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { ContactsService } from "./contacts.service";
import { CreateContactDto, CreateNoteDto, UpdateContactDto } from "./dto";

@ApiTags("Contacts")
@Controller("organizations/:organizationId/contacts")
export class ContactsController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly contacts: ContactsService,
  ) {}

  @Get()
  async getContacts(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("offset", new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.getContacts(org, limit, offset);
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

  /**
   * Edits a contact. Exists because a mistyped phone number cannot otherwise be
   * fixed, and phone is what routes a customer's WhatsApp and Telegram messages
   * to this business: a wrong number sends their messages to the wrong place.
   */
  @Patch(":contactId")
  @ApiOperation({ summary: "Update a contact" })
  async updateContact(
    @Param("organizationId") org: string,
    @Param("contactId", ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Body() body: UpdateContactDto,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.updateContact(org, id, body);
  }

  /**
   * Archives rather than deletes. An order or invoice already points at this row,
   * so removing it would leave history with nothing to point at.
   */
  @Delete(":contactId")
  @HttpCode(200)
  @ApiOperation({ summary: "Archive a contact" })
  async archiveContact(
    @Param("organizationId") org: string,
    @Param("contactId", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.archiveContact(org, id);
  }

  @Get("archived")
  @ApiOperation({ summary: "List archived contacts" })
  async getArchivedContacts(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("offset", new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    await authorizeOrganization(this.auth, req, org, "customers");
    return this.contacts.getArchivedContacts(org, limit, offset);
  }

  @Post(":contactId/convert")
  @ApiOperation({ summary: "Convert a lead into a customer" })
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
