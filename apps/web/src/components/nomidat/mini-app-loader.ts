import { getBusinessData, getBusinessSummary, type BusinessSummary } from "@/data/nomidat";
type View = "home" | "sales" | "customers" | "stock" | "expenses" | "more";
type Rows = Awaited<ReturnType<typeof getBusinessData>>;
type Data = { summary?: BusinessSummary; sales?: Rows; customers?: Rows; products?: Rows; expenses?: Rows };
type Loader = (organizationId: string) => Promise<Data>;

const loaders: Record<View, Loader> = {
  home: loadHome,
  sales: loadSales,
  customers: loadCustomers,
  stock: loadStock,
  expenses: loadExpenses,
  more: async () => ({}),
};

export function loadMiniAppData(view: View, organizationId: string): Promise<Data> {
  return loaders[view](organizationId);
}
async function loadHome(id: string): Promise<Data> {
  const [summary, sales, expenses] = await Promise.all([getBusinessSummary(id), getBusinessData(id, "sales"), getBusinessData(id, "expenses")]);
  return { summary, sales, expenses };
}
async function loadSales(id: string): Promise<Data> { return { sales: await getBusinessData(id, "sales") }; }
async function loadCustomers(id: string): Promise<Data> { return { customers: await getBusinessData(id, "customers") }; }
async function loadStock(id: string): Promise<Data> { return { products: await getBusinessData(id, "inventory") }; }
async function loadExpenses(id: string): Promise<Data> { return { expenses: await getBusinessData(id, "expenses") }; }
