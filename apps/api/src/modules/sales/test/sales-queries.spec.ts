import { it, expect } from "vitest";
import { SalesQueriesService } from "../sales-queries.service";
import { createDbStub } from "../../../common/db/test/db.stub";
it("lists per-sale payments and items without negative debt for an overpaid legacy sale", async () => {
  const { db } = createDbStub([
    [
      { id: "sale-1", totalKobo: 40000 },
      { id: "sale-2", totalKobo: 80000 },
      { id: "sale-3", totalKobo: 50000 },
    ],
    [{ orderId: "sale-1", productName: "Rice", quantity: 2 }],
    [
      { orderId: "sale-1", amount: "20000" },
      { orderId: "sale-2", amount: "90000" },
    ],
  ]);
  const rows = await new SalesQueriesService(db).listSales("shop");
  expect(rows[0]).toMatchObject({
    paidKobo: 20000,
    balanceKobo: 20000,
    saleItems: [{ productName: "Rice", quantity: 2 }],
  });
  expect(rows[1]).toMatchObject({ paidKobo: 90000, balanceKobo: 0, saleItems: [] });
  expect(rows[2]).toMatchObject({ paidKobo: 0, balanceKobo: 50000 });
});
