import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, sql } from "@nomidat/db";
import { product, serialNumber } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { StockService } from "./stock.service";
import type { RegisterSerialDto, UpdateSerialStatusDto } from "./dto/serial-number.dto";

/**
 * Individually-tracked units, e.g. a phone with its own IMEI. Each serial is one
 * physical item, so receiving N units registers N serials rather than a quantity.
 */
@Injectable()
export class SerialNumberService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  async getSerials(
    organizationId: string,
    productId?: string,
    status?: string,
    limit = 50,
    offset = 0,
  ) {
    return this.db
      .select({
        id: serialNumber.id,
        code: serialNumber.code,
        productId: serialNumber.productId,
        variantId: serialNumber.variantId,
        status: serialNumber.status,
        soldAt: serialNumber.soldAt,
        orderId: serialNumber.orderId,
      })
      .from(serialNumber)
      .where(
        and(
          eq(serialNumber.organizationId, organizationId),
          productId ? eq(serialNumber.productId, productId) : undefined,
          status ? eq(serialNumber.status, status as never) : undefined,
        ),
      )
      .orderBy(asc(serialNumber.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Registers serials and books them in. One movement covers the whole batch,
   * because each serial is one unit and they were received together.
   */
  async registerSerials(organizationId: string, dto: RegisterSerialDto, userId?: string | null) {
    const codes = dto.codes.map((code) => code.trim()).filter(Boolean);
    const unique = new Set(codes);

    if (codes.length === 0) {
      throw new ConflictException("Provide at least one serial code.");
    }
    // A duplicate inside one request would otherwise become two rows and pass the
    // unique index check one at a time.
    if (unique.size !== codes.length) {
      throw new ConflictException("The same serial code appears more than once.");
    }

    const quantity = unique.size;
    const warehouseId = dto.warehouseId ?? (await this.stock.resolveDefaultWarehouseId(organizationId));

    return this.db.transaction(async (tx) => {
      const [found] = await tx
        .select({ id: product.id })
        .from(product)
        .where(and(eq(product.organizationId, organizationId), eq(product.id, dto.productId)))
        .limit(1);
      if (!found) throw new NotFoundException("Product not found in this business.");

      // Pre-check so a clash names the offending code instead of surfacing a raw
      // unique-constraint error from the insert below.
      const existing = await tx
        .select({ code: serialNumber.code })
        .from(serialNumber)
        .where(
          and(
            eq(serialNumber.organizationId, organizationId),
            sql`${serialNumber.code} in ${[...unique]}`,
          ),
        );
      if (existing.length > 0) {
        throw new ConflictException(`Already registered: ${existing.map((row) => row.code).join(", ")}.`);
      }

      const created = await tx
        .insert(serialNumber)
        .values(
          [...unique].map((code) => ({
            organizationId,
            productId: dto.productId,
            variantId: dto.variantId ?? null,
            code,
            status: "in_stock" as const,
          })),
        )
        .returning();

      await this.stock.recordMovementTx(tx, organizationId, {
        productId: dto.productId,
        variantId: dto.variantId,
        warehouseId,
        quantity,
        type: "inbound_receive",
        referenceType: "serial_number",
        notes: `${quantity} serialised unit(s) received`,
        userId,
      });

      return created;
    });
  }

  /**
   * Moves a serial through its lifecycle. Each transition is guarded so a sold
   * unit cannot silently return to stock, which would overstate inventory.
   */
  async updateStatus(organizationId: string, id: string, dto: UpdateSerialStatusDto) {
    const allowed: Record<string, string[]> = {
      in_stock: ["sold", "void"],
      sold: ["returned"],
      returned: ["in_stock", "void"],
      void: [],
    };

    return this.db.transaction(async (tx) => {
      const [found] = await tx
        .select({ id: serialNumber.id, status: serialNumber.status })
        .from(serialNumber)
        .where(and(eq(serialNumber.organizationId, organizationId), eq(serialNumber.id, id)))
        .limit(1);
      if (!found) throw new NotFoundException("Serial number not found in this business.");

      if (!allowed[found.status]?.includes(dto.status)) {
        throw new ConflictException(`A ${found.status.replace("_", " ")} unit cannot become ${dto.status.replace("_", " ")}.`);
      }

      const [updated] = await tx
        .update(serialNumber)
        .set({
          status: dto.status,
          soldAt: dto.status === "sold" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(serialNumber.id, id))
        .returning();

      return updated;
    });
  }
}