import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString, IsNumber, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterSupplierDto {
  // 1. Phân trang & Tìm kiếm cơ bản
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  // 2. Lọc theo Nhóm (Mảng các tên nhóm)
  @ApiProperty({ required: false, description: 'Danh sách tên nhóm' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  groupNames?: string[];

  // 3. Lọc theo Nợ hiện tại (current_debt)
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  minDebt?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  maxDebt?: number;

  // 4. Lọc theo Tổng mua (total_revenue)
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  minRevenue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  maxRevenue?: number;

  // 5. Lọc theo Thời gian tạo (created_at)
  @ApiProperty({ required: false, description: 'Từ ngày (ISO Date)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiProperty({ required: false, description: 'Đến ngày (ISO Date)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  // 6. Trạng thái
  @ApiProperty({ required: false, default: 'active' })
  @IsOptional()
  status?: string; // 'active', 'inactive', 'all'
}
