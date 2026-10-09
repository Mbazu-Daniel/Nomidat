import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

class TransferLineDto {
  @IsUUID()
  @IsString()
  productId!: string;

  @IsOptional()
  @IsUUID()
  @IsString()
  variantId?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;
}

export class CreateTransferDto {
  @IsUUID()
  @IsString()
  fromWarehouseId!: string;

  @IsUUID()
  @IsString()
  toWarehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  items!: TransferLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

class CountLineDto {
  @IsUUID()
  @IsString()
  productId!: string;

  @IsOptional()
  @IsUUID()
  @IsString()
  variantId?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  countedQuantity!: number;
}

export class CreateCycleCountDto {
  @IsUUID()
  @IsString()
  warehouseId!: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  items!: CountLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

class ReturnLineDto {
  @IsUUID()
  @IsString()
  productId!: string;

  @IsOptional()
  @IsUUID()
  @IsString()
  variantId?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  unitPriceMinor?: number;
}

export class CreateReturnDto {
  @IsOptional()
  @IsUUID()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  @IsString()
  contactId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items!: ReturnLineDto[];

  /** When false the goods are written off rather than put back into sellable stock. */
  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class PurchaseOrderLineDto {
  @IsUUID()
  @IsString()
  productId!: string;

  @IsOptional()
  @IsUUID()
  @IsString()
  variantId?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantityOrdered!: number;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  unitCostMinor!: number;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  @IsString()
  supplierId?: string;

  @IsUUID()
  @IsString()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  items!: PurchaseOrderLineDto[];

  @IsOptional()
  @IsISO8601()
  expectedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  items!: CountLineDto[];

  @IsOptional()
  @IsISO8601()
  receivedAt?: string;
}
