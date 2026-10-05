import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, sql } from "@nomidat/db";
import { auditLog } from "@nomidat/db/schema";
import {
  MAX_AUDIT_METADATA_BYTES,
  MAX_AUDIT_PAGE_SIZE,
  type AuditAction,
} from "./audit.constants";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

export type AuditActor = {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
};

export type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

  /**
   * Best-effort by design: failing a customer's payment because the audit insert
   * hiccuped is worse than losing the entry.
   */
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async record(organizationId: string, actor: AuditActor, entry: AuditEntry) {
    try {
      await this.db.insert(auditLog).values({
        organizationId,
        actorUserId: actor.userId ?? null,
        actorEmail: actor.email ?? null,
        actorRole: actor.role ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: this.truncateMetadata(entry.metadata),
        ipAddress: entry.ipAddress ?? null,
      });
    } catch (error) {
      // eslint-disable-next-line no-console -- an audit write must not break the request it describes
      console.error("audit_write_failed", { organizationId, action: entry.action, error });
    }
  }

  /**
   * Reads the trail newest-first. Paginated because an unbounded select against an
   * append-only table is how an audit page takes down a deployment.
   */
  async list(organizationId: string, limit: number, offset: number) {
    const pageSize = Math.min(Math.max(limit, 1), MAX_AUDIT_PAGE_SIZE);

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          actorEmail: auditLog.actorEmail,
          actorRole: auditLog.actorRole,
          metadata: auditLog.metadata,
          ipAddress: auditLog.ipAddress,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .where(eq(auditLog.organizationId, organizationId))
        .orderBy(desc(auditLog.createdAt))
        .limit(pageSize)
        .offset(Math.max(offset, 0)),
      this.db
        .select({ value: count() })
        .from(auditLog)
        .where(eq(auditLog.organizationId, organizationId)),
    ]);

    return { entries: rows, total: Number(total?.value ?? 0) };
  }

  /** Everything one record has had done to it — the "who touched this?" view. */
  async getForEntity(organizationId: string, entityType: string, entityId: string) {
    return this.db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        actorEmail: auditLog.actorEmail,
        actorRole: auditLog.actorRole,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.organizationId, organizationId),
          eq(auditLog.entityType, entityType),
          eq(auditLog.entityId, entityId),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(MAX_AUDIT_PAGE_SIZE);
  }

  /** Entry counts per action, for a summary header. */
  async summarize(organizationId: string, since: Date) {
    return this.db
      .select({ action: auditLog.action, value: count() })
      .from(auditLog)
      .where(and(eq(auditLog.organizationId, organizationId), gte(auditLog.createdAt, since)))
      .groupBy(auditLog.action)
      .orderBy(sql`${count()} desc`);
  }

  private truncateMetadata(metadata: Record<string, unknown> | null | undefined) {
    if (!metadata) return null;
    const serialized = JSON.stringify(metadata);
    if (serialized.length <= MAX_AUDIT_METADATA_BYTES) {
      return metadata as Record<string, unknown>;
    }
    // Keep the shape but drop the payload, so the row still records that
    // something large happened without storing an unbounded blob.
    return { truncated: true, bytes: serialized.length };
  }
}
