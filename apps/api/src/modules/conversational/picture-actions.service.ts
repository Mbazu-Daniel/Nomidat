import { BadRequestException, Injectable } from "@nestjs/common";
import { formatMinorAmount, majorToMinor } from "../../common/helpers/money-format";
import { InventoryService } from "../inventory/inventory.service";
import { SalesService } from "../sales/sales.service";
import type { ParsedAction } from "./types";

@Injectable()
export class PictureActionsService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly sales: SalesService,
  ) {}
  async execute(action: ParsedAction, organizationId: string, userId: string, currency: string) {
    if (action.intent === "create_product") {
      if (
        !action.productName ||
        action.stockQuantity === undefined ||
        action.unitPriceNaira === undefined
      )
        throw new BadRequestException("Product details are incomplete.");
      const created = await this.inventory.createProduct(organizationId, {
        name: action.productName,
        stockQuantity: action.stockQuantity,
        priceMinor: majorToMinor(action.unitPriceNaira, currency),
        unit: action.unit ?? "units",
      });
      return `Created ${created.name} with ${created.stockQuantity} ${created.unit}.`;
    }
    if (!action.items) throw new BadRequestException("Sale items are required.");
    if (action.customerName && !action.contactId)
      throw new BadRequestException(
        "Please provide the customer ID or record this as a walk-in sale.",
      );
    const discountMinor = majorToMinor(action.discountNaira ?? 0, currency);
    // Figures for the confirmation sentence only. The recorded Order is priced and
    // taxed by the sale seams, so what the seller reads back comes from the books.
    const statedMinor =
      action.items.reduce(
        (sum, item) => sum + item.quantity * majorToMinor(item.unitPriceNaira, currency),
        0,
      ) -
      discountMinor;
    const sale = await this.sales.createSale(organizationId, userId, {
      customerId: action.contactId,
      items: action.items.map((item) => ({
        productName: item.description,
        quantity: item.quantity,
        unitPriceMinor: majorToMinor(item.unitPriceNaira, currency),
      })),
      discountMinor,
      paymentAmountMinor: action.paid ? statedMinor : 0,
      paymentMethod: action.paymentMethod ?? "cash",
      notes: "Recorded from reviewed channel picture",
    });
    return `Sale recorded. Total ${formatMinorAmount(sale.totalMinor, currency)}; outstanding ${formatMinorAmount(sale.balanceMinor, currency)}.`;
  }
}
