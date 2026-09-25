import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, sql } from "@nomidat/db";
import { contact, invoice, note, order, payment } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateContactDto, CreateNoteDto } from "./dto";

@Injectable()
export class ContactsService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getContacts(organizationId: string, offset = 0) {
    return this.db
      .select()
      .from(contact)
      .where(and(eq(contact.organizationId, organizationId), eq(contact.isActive, true)))
      .orderBy(desc(contact.createdAt), desc(contact.id))
      .limit(50)
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
    const [orders, invoices, notes, totals] = await Promise.all([
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
      this.db
        .select({
          balanceKobo: sql<number>`coalesce(sum(greatest(0, ${order.totalKobo} - coalesce((select sum(${payment.amountKobo}) from ${payment} where ${payment.orderId} = "orders"."id" and ${payment.organizationId} = ${organizationId}), 0))), 0)`,
        })
        .from(order)
        .where(
          and(
            eq(order.organizationId, organizationId),
            eq(order.contactId, contactId),
            eq(order.status, "pending"),
          ),
        ),
    ]);
    return {
      contact: customer,
      orders,
      invoices,
      notes,
      balanceKobo: Number(totals[0].balanceKobo),
    };
  }
}
