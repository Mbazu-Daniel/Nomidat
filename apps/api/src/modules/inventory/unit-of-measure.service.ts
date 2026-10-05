import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "@nomidat/db";
import { unitConversion, unitOfMeasure } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type {
  CreateUnitConversionDto,
  CreateUnitOfMeasureDto,
  UpdateUnitOfMeasureDto,
} from "./dto/catalog.dto";

@Injectable()
export class UnitOfMeasureService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  getUnits(organizationId: string) {
    return this.db
      .select()
      .from(unitOfMeasure)
      .where(eq(unitOfMeasure.organizationId, organizationId))
      .orderBy(asc(unitOfMeasure.category), asc(unitOfMeasure.code));
  }

  async createUnit(organizationId: string, input: CreateUnitOfMeasureDto) {
    await this.assertUnitCodeFree(organizationId, input.code);
    const [created] = await this.db
      .insert(unitOfMeasure)
      .values({
        organizationId,
        name: input.name.trim(),
        code: input.code,
        category: input.category,
        precision: input.precision ?? 0,
      })
      .returning();
    return created;
  }

  async updateUnit(organizationId: string, unitId: string, input: UpdateUnitOfMeasureDto) {
    const existing = await this.getUnit(organizationId, unitId);
    const [updated] = await this.db
      .update(unitOfMeasure)
      .set({
        name: input.name?.trim() ?? existing.name,
        precision: input.precision ?? existing.precision,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(unitOfMeasure.id, unitId), eq(unitOfMeasure.organizationId, organizationId)))
      .returning();

    return updated;
  }

  async createConversion(organizationId: string, input: CreateUnitConversionDto) {
    const [from, to] = await Promise.all([
      this.getUnit(organizationId, input.fromUnitOfMeasureId),
      this.getUnit(organizationId, input.toUnitOfMeasureId),
    ]);

    if (from.id === to.id) {
      throw new BadRequestException("A unit cannot be converted into itself.");
    }
    if (from.category !== to.category) {
      throw new BadRequestException(
        `Cannot convert ${from.code} to ${to.code}: they measure different things.`,
      );
    }

    const [existing] = await this.db
      .select({ id: unitConversion.id })
      .from(unitConversion)
      .where(
        and(
          eq(unitConversion.organizationId, organizationId),
          eq(unitConversion.fromUnitOfMeasureId, from.id),
          eq(unitConversion.toUnitOfMeasureId, to.id),
        ),
      )
      .limit(1);
    if (existing) {
      throw new ConflictException("That conversion is already defined.");
    }

    const [created] = await this.db
      .insert(unitConversion)
      .values({
        organizationId,
        fromUnitOfMeasureId: from.id,
        toUnitOfMeasureId: to.id,
        factor: input.factor,
      })
      .returning();
    return created;
  }

  getConversions(organizationId: string) {
    return this.db
      .select()
      .from(unitConversion)
      .where(eq(unitConversion.organizationId, organizationId));
  }

  private async getUnit(organizationId: string, unitId: string) {
    const [unit] = await this.db
      .select()
      .from(unitOfMeasure)
      .where(and(eq(unitOfMeasure.id, unitId), eq(unitOfMeasure.organizationId, organizationId)))
      .limit(1);

    if (!unit) throw new NotFoundException("Unit of measure not found.");
    return unit;
  }

  private async assertUnitCodeFree(organizationId: string, code: string) {
    const [existing] = await this.db
      .select({ id: unitOfMeasure.id })
      .from(unitOfMeasure)
      .where(and(eq(unitOfMeasure.organizationId, organizationId), eq(unitOfMeasure.code, code)))
      .limit(1);

    if (existing) throw new ConflictException(`Unit code "${code}" is already in use.`);
  }
}
