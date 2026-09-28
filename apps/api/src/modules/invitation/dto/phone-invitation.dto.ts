import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, Matches } from "class-validator";
export class PhoneInvitationDto {
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsIn(
    [
      "staff",
      "member",
      "manager",
      "inventory_writer",
      "sales_writer",
      "expenses_writer",
      "invoices_writer",
      "customers_writer",
      "channels_writer",
    ],
    { each: true },
  )
  roles!: string[];
}
