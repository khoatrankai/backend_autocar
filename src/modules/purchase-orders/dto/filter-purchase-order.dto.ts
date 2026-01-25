// src/modules/purchase-orders/dto/filter-purchase-order.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString, IsNumber, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterPurchaseOrderDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Tìm theo mã phiếu, tên NCC' })
  @IsOptional()
  @IsString()
  search?: string;

  // 1. Lọc theo Chi nhánh (Kho)
  @ApiProperty({ required: false, type: [Number], description: 'List ID kho' })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map(Number) : value,
  )
  warehouseIds?: number[];

  // 2. Lọc theo Trạng thái ('draft', 'completed', 'cancelled')
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  statuses?: string[];

  // 3. Lọc theo Thời gian (import_date)
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dateTo?: string;

  // 4. Lọc theo Người tạo / Người nhập (staff_id)
  @ApiProperty({
    required: false,
    type: [String],
    description: 'List UUID nhân viên',
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  staffIds?: string[];
}
