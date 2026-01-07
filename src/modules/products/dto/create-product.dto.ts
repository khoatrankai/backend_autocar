import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  IsNotEmpty,
  ValidateNested,
  IsArray,
} from 'class-validator';

class ProductCompatibilityDto {
  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  car_make: string;

  @ApiProperty({ example: 'Vios' })
  @IsString()
  @IsNotEmpty()
  car_model: string;

  @ApiProperty({ example: 2018, required: false })
  @IsOptional()
  @IsNumber()
  year_start?: number;

  @ApiProperty({ example: 2022, required: false })
  @IsOptional()
  @IsNumber()
  year_end?: number;
}

// 2. DTO cho phần Tồn kho ban đầu (Con)
class InitialInventoryDto {
  @ApiProperty({ example: 1, description: 'ID của Kho' })
  @IsNumber()
  warehouse_id: number;

  @ApiProperty({ example: 100, description: 'Số lượng nhập ban đầu' })
  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CreateProductDto {
  @ApiProperty({ example: '464200D131', description: 'Mã phụ tùng (Unique)' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'Rotuyn lái ngoài Toyota Vios' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Toyota', required: false })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ example: 'Cái' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 150000 })
  @IsNumber()
  @Min(0)
  cost_price: number;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Min(0)
  retail_price: number;

  @ApiProperty({ example: 1, description: 'ID Danh mục' })
  @IsNumber()
  category_id: number;

  // --- MẢNG CON (Nhập cùng lúc) ---

  @ApiProperty({ type: [ProductCompatibilityDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductCompatibilityDto)
  compatibility?: ProductCompatibilityDto[];

  @ApiProperty({ type: [InitialInventoryDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialInventoryDto)
  inventory?: InitialInventoryDto[];
}
