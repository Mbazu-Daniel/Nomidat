import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from "class-validator";

const SERIAL_STATUSES = ["in_stock", "sold", "returned", "void"] as const;

export class RegisterSerialDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ type: [String], description: "One code per physical unit" })
  @IsArray()
  @IsString({ each: true })
  codes!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class UpdateSerialStatusDto {
  @ApiProperty({ enum: SERIAL_STATUSES })
  @IsIn(SERIAL_STATUSES)
  status!: (typeof SERIAL_STATUSES)[number];
}