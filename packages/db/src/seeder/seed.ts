import { resolve } from "node:path";
import { config } from "dotenv";
import { seedExpenseCategories } from "./seed-expense-categories";

config({ path: resolve(__dirname, "../../../../.env") });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  }
  const { total, inserted } = await seedExpenseCategories(connectionString);
  console.log(`seed: ${inserted} new expense categories inserted (${total} defaults)`);
}

void main().catch((error) => {
  console.error("seed failed:", error);
  process.exit(1);
});
