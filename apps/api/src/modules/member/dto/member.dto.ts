import { Type } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ListMembersQueryDto {
  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ example: "createdAt" })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsString()
  sortDirection?: "asc" | "desc";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filterField?: string;

  @ApiPropertyOptional({
    enum: [
      "eq",
      "ne",
      "lt",
      "lte",
      "gt",
      "gte",
      "in",
      "not_in",
      "contains",
      "starts_with",
      "ends_with",
    ],
  })
  @IsOptional()
  @IsString()
  filterOperator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  filterValue?: string | number | boolean;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] })
  @IsNotEmpty()
  role!: string | string[];
}

export class AddMemberDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string | null;

  @ApiProperty({ oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] })
  @IsNotEmpty()
  role!: string | string[];
}
