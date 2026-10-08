import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { contact, invoice, note, order } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { SalesQueriesService } from "../sales/sales-queries.service";
import type { CreateContactDto, CreateNoteDto, UpdateContactDto } from "./dto";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class ContactsService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly queries: SalesQueriesService,
  ) {}

  async getContacts(organizationId: string, limit = DEFAULT_LIMIT, offset = 0) {
    return this.db
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, organizationId), eq(contact.isActive, true)))
      .orderBy(desc(contact.createdAt), desc(contact.id))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));
  }

  async getContact(organizationId: string, contactId: string) {
    const [row] = await this.db
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, organizationId), eq(contact.id, contactId)))
      .limit(1);
    if (!row) throw new NotFoundException("Contact not found.");
    return row;
  }

  async createContact(organizationId: string, input: CreateContactDto) {
    const [row] = await this.db
      .insert(contact)
      .values({
        organizationId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        kind: input.kind,
        source: "dashboard",
      })
      .returning();
    return row;
  }

  async updateCustomer(organizationId: string, contactId: string) {
    const [row] = await this.db
      .update(contact)
      .set({ kind: "customer", updatedAt: new Date() })
      .where(and(eq(contact.organizationId, organizationId), eq(contact.id, contactId)))
      .returning();
    if (!row) throw new NotFoundException("Contact not found.");
    return row;
  }

  /**
   * Edits a contact, including the phone number that anchors their WhatsApp and
   * Telegram identity.
   *
   * Only the fields present in the body are written, so a caller fixing one typo
   * does not have to send the whole contact back. An empty `phone` is stored as
   * null rather than as `""`: an empty string would pass the length check and
   * then compare equal to nothing in a search.
   *
   * Archived contacts are refused here rather than silently brought back, so
   * restoring one is a deliberate act.
   */
  async updateContact(organizationId: string, contactId: string, input: UpdateContactDto) {
    const patch: Partial<typeof contact.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone || null;
    if (input.email !== undefined) patch.email = input.email;
    if (input.kind !== undefined) patch.kind = input.kind;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("Provide at least one field to change.");
    }
    patch.updatedAt = new Date();

    const [row] = await this.db
      .update(contact)
      .set(patch)
      .where(
        and(
          eq(contact.organizationId, organizationId),
          eq(contact.id, contactId),
          eq(contact.isActive, true),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Contact not found.");
    return row;
  }

  /**
   * Hides a contact from the working lists without destroying its history.
   *
   * Archiving rather than deleting, because an order, invoice or note already
   * points at this row: a customer with a purchase history cannot simply stop
   * existing, and the books still have to foot after they are archived.
   */
  async archiveContact(organizationId: string, contactId: string) {
    const [row] = await this.db
      .update(contact)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(contact.organizationId, organizationId),
          eq(contact.id, contactId),
          eq(contact.isActive, true),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Contact not found.");
    return row;
  }

  /** Archived contacts, kept visible so an archived row is findable and reversible. */
  async getArchivedContacts(organizationId: string, limit = DEFAULT_LIMIT, offset = 0) {
    return this.db
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, organizationId), eq(contact.isActive, false)))
      .orderBy(desc(contact.updatedAt), desc(contact.id))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));
  }

  async createNote(
    organizationId: string,
    contactId: string,
    userId: string,
    input: CreateNoteDto,
  ) {
    await this.getContact(organizationId, contactId);
    const [row] = await this.db
      .insert(note)
      .values({ organizationId, contactId, createdByUserId: userId, body: input.body })
      .returning();
    return row;
  }

  async getClientFolder(organizationId: string, contactId: string) {
    const customer = await this.getContact(organizationId, contactId);
    const [orders, invoices, notes, balance] = await Promise.all([
      this.db
        .select()
        .from(order)
        .where(and(eq(order.organizationId, organizationId), eq(order.contactId, contactId)))
        .orderBy(desc(order.createdAt))
        .limit(50),
      this.db
        .select()
        .from(invoice)
        .where(and(eq(invoice.organizationId, organizationId), eq(invoice.contactId, contactId)))
        .orderBy(desc(invoice.createdAt))
        .limit(50),
      this.db
        .select()
        .from(note)
        .where(and(eq(note.organizationId, organizationId), eq(note.contactId, contactId)))
        .orderBy(desc(note.createdAt))
        .limit(50),
      // Routed through the sales seam rather than derived here. A second copy of
      // "what does this contact owe" is one that will eventually disagree with
      // this one — and it already did, because this one clamped each order
      // separately while the balance endpoint clamps the total.
      this.queries.getCustomerBalance(organizationId, contactId),
    ]);
    return {
      contact: customer,
      orders,
      invoices,
      notes,
      balanceMinor: balance.outstandingMinor,
    };
  }
}
