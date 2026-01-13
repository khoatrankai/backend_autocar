import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum StockStatus {
  ALL = 'all',
  IN_STOCK = 'in_stock', // Còn hàng (quantity > 0)
  OUT_OF_STOCK = 'out_of_stock', // Hết hàng (quantity <= 0)
}

export class FilterProductDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Tìm theo Tên hoặc SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  // --- CÁC TRƯỜNG MỚI DỰA THEO ẢNH ---

  @ApiProperty({ required: false, description: 'Lọc theo ID Nhóm hàng' })
  @IsOptional()
  @Type(() => Number) // Nhận vào number, sẽ convert sang BigInt trong Service
  categoryId?: number;

  @ApiProperty({ required: false, description: 'Lọc theo ID Nhà cung cấp' })
  @IsOptional()
  @Type(() => Number)
  supplierId?: number;

  @ApiProperty({
    required: false,
    enum: StockStatus,
    description: 'Trạng thái tồn kho: all, in_stock, out_of_stock',
  })
  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  @ApiProperty({
    required: false,
    description: 'Lọc theo Thương hiệu (Tìm trong bảng Xe tương thích)',
  })
  @IsOptional()
  @IsString()
  brand?: string; // Tương ứng với car_make trong product_compatibility

  @ApiProperty({ required: false, description: 'Lọc theo Vị trí kho' })
  @IsOptional()
  @IsString()
  location?: string; // Tương ứng với location_code trong inventory

  @ApiProperty({ required: false, description: 'Ngày tạo từ (ISO String)' })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiProperty({ required: false, description: 'Ngày tạo đến (ISO String)' })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;
}
