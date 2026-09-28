import { BadRequestException, Injectable } from "@nestjs/common";
import { InventoryService } from "../inventory/inventory.service";
import { SalesService } from "../sales/sales.service";
import type { ParsedAction } from "./types";

@Injectable()
export class PictureActionsService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly sales: SalesService,
  ) {}
  async execute(action: ParsedAction, organizationId: string, userId: string) {
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
        priceKobo: Math.round(action.unitPriceNaira * 100),
        unit: action.unit ?? "units",
      });
      return `Created ${created.name} with ${created.stockQuantity} ${created.unit}.`;
    }
    if (!action.items) throw new BadRequestException("Sale items are required.");
    if (action.customerName && !action.contactId)
      throw new BadRequestException(
        "Please provide the customer ID or record this as a walk-in sale.",
      );
    const total =
      action.items.reduce(
        (sum, item) => sum + item.quantity * Math.round(item.unitPriceNaira * 100),
        0,
      ) +
      Math.round((action.taxNaira ?? 0) * 100) -
      Math.round((action.discountNaira ?? 0) * 100);
    const sale = await this.sales.createSale(organizationId, userId, {
      customerId: action.contactId,
      items: action.items.map((item) => ({
        productName: item.description,
        quantity: item.quantity,
        unitPriceKobo: Math.round(item.unitPriceNaira * 100),
      })),
      taxKobo: Math.round((action.taxNaira ?? 0) * 100),
      discountKobo: Math.round((action.discountNaira ?? 0) * 100),
      paymentAmountKobo: action.paid ? total : 0,
      paymentMethod: action.paymentMethod ?? "cash",
      notes: "Recorded from reviewed channel picture",
    });
    return `Sale recorded. Total NGN ${sale.totalKobo / 100}; outstanding NGN ${sale.balanceKobo / 100}.`;
  }
}
