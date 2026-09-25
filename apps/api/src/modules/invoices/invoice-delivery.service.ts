import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, eq } from "@nomidat/db";
import { channelIdentity, organization } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import { EMAIL_CLIENT } from "../../common/email/email.module";
import type { EmailClient } from "@nomidat/email";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { ChannelProvider } from "../channel/types";
import { InvoicesService } from "./invoices.service";
import { createInvoicePdf } from "./invoice-pdf";
import type { SendInvoiceDto } from "./dto";

@Injectable()
export class InvoiceDeliveryService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(EMAIL_CLIENT) private readonly email: EmailClient | null,
    private readonly invoices: InvoicesService,
    private readonly telegram: TelegramClient,
    private readonly whatsapp: WhatsAppClient,
  ) {}

  async getPdf(organizationId: string, invoiceId: string) {
    const document = await this.invoices.getInvoice(organizationId, invoiceId);
    const [business] = await this.db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    if (!business) throw new BadRequestException("Business not found.");
    const pdf = await createInvoicePdf(document, business.name);
    const directory = resolve(this.env.INVOICE_STORAGE_DIR, organizationId);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, `${invoiceId}.pdf`), pdf, { mode: 0o600 });
    return pdf;
  }

  async createDelivery(organizationId: string, invoiceId: string, input: SendInvoiceDto) {
    const document = await this.invoices.getInvoice(organizationId, invoiceId);
    const pdf = await this.getPdf(organizationId, invoiceId);
    if (input.channel === "email") {
      if (!this.email) throw new ServiceUnavailableException("Email delivery is not configured.");
      if (!input.email) throw new BadRequestException("A recipient email is required.");
      await this.email.send({
        to: { address: input.email },
        subject: `Invoice ${document.invoiceNumber}`,
        html: "<p>Your invoice is attached.</p>",
        attachments: [
          {
            name: `${document.invoiceNumber}.pdf`,
            mimeType: "application/pdf",
            content: pdf.toString("base64"),
          },
        ],
      });
    } else {
      if (!input.channelIdentityId) throw new BadRequestException("Select a linked channel.");
      const [identity] = await this.db
        .select()
        .from(channelIdentity)
        .where(
          and(
            eq(channelIdentity.organizationId, organizationId),
            eq(channelIdentity.id, input.channelIdentityId),
            eq(channelIdentity.provider, input.channel),
          ),
        )
        .limit(1);
      if (!identity) throw new BadRequestException("Linked channel not found for this business.");
      if (
        input.channel === "whatsapp" &&
        (!identity.lastInboundAt || Date.now() - identity.lastInboundAt.getTime() >= 86_400_000)
      )
        throw new BadRequestException(
          "Ask the recipient to message your WhatsApp bot first; the 24-hour document delivery window is closed.",
        );
      const expires = Date.now() + 3_600_000;
      const token = this.getSignature(organizationId, invoiceId, expires);
      const documentUrl = `${this.env.BETTER_AUTH_URL}/api/v1/invoice-documents/${organizationId}/${invoiceId}?expires=${expires}&token=${token}`;
      const adapter = input.channel === "telegram" ? this.telegram : this.whatsapp;
      await adapter.createOutboundMessage({
        provider:
          input.channel === "telegram" ? ChannelProvider.Telegram : ChannelProvider.WhatsApp,
        externalId: identity.externalId,
        kind: "document",
        documentUrl,
        documentFilename: `${document.invoiceNumber}.pdf`,
        text: `Invoice ${document.invoiceNumber}`,
      });
    }
    return { delivered: true };
  }

  getSignedPdf(organizationId: string, invoiceId: string, expires: number, token: string) {
    const expected = Buffer.from(this.getSignature(organizationId, invoiceId, expires));
    const supplied = Buffer.from(token);
    if (
      !Number.isSafeInteger(expires) ||
      expires < Date.now() ||
      expires > Date.now() + 3_600_000 ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new ForbiddenException("Document link is invalid or expired.");
    return this.getPdf(organizationId, invoiceId);
  }

  private getSignature(org: string, id: string, expires: number) {
    return createHmac("sha256", this.env.BETTER_AUTH_SECRET)
      .update(`invoice:${org}:${id}:${expires}`)
      .digest("hex");
  }
}
