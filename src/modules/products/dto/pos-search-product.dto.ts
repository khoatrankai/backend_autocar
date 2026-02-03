import { IsOptional, IsString } from 'class-validator';

export class PosSearchProductDto {
  @IsOptional()
  @IsString()
  keyword?: string; // Search by Product Name or SKU

  @IsOptional()
  @IsString()
  car_model?: string; // Filter by Car Model (Important)
}
