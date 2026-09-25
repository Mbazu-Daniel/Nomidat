import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { and, eq, isNull, or, sql } from "@nomidat/db";
import { paymentLink } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { PaystackService } from "./providers/paystack/paystack.service";
import { PaymentNotificationService } from "./payment-notification.service";

@Injectable()
export class PaymentReconciliationService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private readonly logger = new Logger(PaymentReconciliationService.name);
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly paystack: PaystackService,
    private readonly notifications: PaymentNotificationService,
  ) {}

  onModuleInit() {
    this.schedule();
  }
  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private schedule() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(23, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    this.timer = setTimeout(async () => {
      try {
        await this.updatePayments();
      } catch (error) {
        this.logger.error({
          event: "payment_reconciliation_failed",
          error: error instanceof Error ? error.name : "UnknownError",
        });
      } finally {
        if (!this.stopped) this.schedule();
      }
    }, next.getTime() - now.getTime());
    this.timer.unref();
  }

  async updatePayments() {
    let cursor = "00000000-0000-0000-0000-000000000000";
    while (!this.stopped) {
      const rows = await this.db
        .select()
        .from(paymentLink)
        .where(
          and(
            sql`${paymentLink.id} > ${cursor}`,
            or(
              eq(paymentLink.status, "pending"),
              and(eq(paymentLink.status, "paid"), isNull(paymentLink.notifiedAt)),
            ),
          ),
        )
        .orderBy(paymentLink.id)
        .limit(100);
      if (!rows.length) return;
      for (const row of rows) await this.reconcile(row);
      cursor = rows[rows.length - 1].id;
    }
  }
  private async reconcile(row: typeof paymentLink.$inferSelect) {
    try {
      if (row.status === "pending")
        await this.paystack.verifyPayment(row.organizationId, row.reference);
      else await this.notifications.createNotification(row.reference);
    } catch (error) {
      this.logger.warn({
        event: "payment_reconciliation_deferred",
        paymentLinkId: row.id,
        error: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
