import { IsIn } from "class-validator";

export class ExtractPictureDto {
  @IsIn(["sales", "inventory", "expenses", "invoices"])
  purpose!: "sales" | "inventory" | "expenses" | "invoices";
}
