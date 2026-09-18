import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CheckOrganizationSlugDto {
  @ApiProperty({ example: "my-org" })
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
