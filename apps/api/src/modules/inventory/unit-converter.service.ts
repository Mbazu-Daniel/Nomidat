import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { unitConversion, unitOfMeasure } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

interface UnitRow {
  id: string;
  code: string;
  category: string;
  precision: number;
}

interface ConversionRow {
  fromUnitOfMeasureId: string;
  toUnitOfMeasureId: string;
  factor: number;
}

/**
 * Converts a quantity between units. One method for callers: everything about
 * walking the conversion graph, detecting cycles and refusing nonsense is hidden
 * behind it, so POS, purchasing and transfers never re-implement it.
 */
@Injectable()
export class UnitConverter {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  /**
   * Converts `quantity` from one unit code to another, following a chain of
   * conversions when no direct factor exists (kg -> g -> lb).
   */
  async convert(
    organizationId: string,
    quantity: number,
    fromCode: string,
    toCode: string,
  ): Promise<number> {
    const units = await this.loadUnits(organizationId);
    const from = units.find((unit) => unit.code === fromCode);
    const to = units.find((unit) => unit.code === toCode);

    if (!from) throw new NotFoundException(`Unknown unit of measure "${fromCode}".`);
    if (!to) throw new NotFoundException(`Unknown unit of measure "${toCode}".`);
    if (from.category !== to.category) {
      throw new BadRequestException(`Cannot convert ${fromCode} to ${toCode}: different measures.`);
    }
    if (from.id === to.id) return roundTo(quantity, to.precision);

    const edges = await this.loadConversions(organizationId);
    const factor = this.getFactor(from.id, to.id, edges);
    return roundTo(quantity * factor, to.precision);
  }

  /**
   * Breadth-first over the conversion graph, so a chain is found without the
   * caller having to know one exists. Tracks visited units to survive a cycle.
   */
  private getFactor(fromId: string, toId: string, edges: ConversionRow[]): number {
    const bySource = new Map<string, ConversionRow[]>();
    for (const edge of edges) {
      bySource.set(edge.fromUnitOfMeasureId, [
        ...(bySource.get(edge.fromUnitOfMeasureId) ?? []),
        edge,
      ]);
    }

    type Step = { unitId: string; factor: number };
    const queue: Step[] = [{ unitId: fromId, factor: 1 }];
    const seen = new Set([fromId]);

    while (queue.length) {
      const step = queue.shift()!;
      if (step.unitId === toId) return step.factor;

      for (const edge of bySource.get(step.unitId) ?? []) {
        if (seen.has(edge.toUnitOfMeasureId)) continue;
        seen.add(edge.toUnitOfMeasureId);
        queue.push({ unitId: edge.toUnitOfMeasureId, factor: step.factor * Number(edge.factor) });
      }
    }

    throw new BadRequestException("No conversion path is defined between these units.");
  }

  private async loadUnits(organizationId: string): Promise<UnitRow[]> {
    return this.db
      .select({
        id: unitOfMeasure.id,
        code: unitOfMeasure.code,
        category: unitOfMeasure.category,
        precision: unitOfMeasure.precision,
      })
      .from(unitOfMeasure)
      .where(and(eq(unitOfMeasure.organizationId, organizationId), eq(unitOfMeasure.isActive, true)));
  }

  private async loadConversions(organizationId: string): Promise<ConversionRow[]> {
    return this.db
      .select({
        fromUnitOfMeasureId: unitConversion.fromUnitOfMeasureId,
        toUnitOfMeasureId: unitConversion.toUnitOfMeasureId,
        factor: unitConversion.factor,
      })
      .from(unitConversion)
      .where(eq(unitConversion.organizationId, organizationId));
  }
}

/** Keeps a converted quantity within the precision the target unit is quoted in. */
export function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
