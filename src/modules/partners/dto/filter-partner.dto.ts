import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartnerType } from './create-partner.dto'; // Giả sử enum nằm ở đây

export class FilterPartnerDto {
  // --- 1. CƠ BẢN ---
  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên, mã, email hoặc số điện thoại',
    example: 'KH001',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: PartnerType,
    description: 'Lọc theo loại đối tác (customer/supplier)',
  })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType;

  // --- 2. PHÂN TRANG ---
  @ApiPropertyOptional({ default: 1, description: 'Số trang hiện tại' })
  @IsOptional()
  @Type(() => Number) // Quan trọng: Convert query string "1" -> number 1
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 10,
    description: 'Số bản ghi trên mỗi trang',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  // --- 3. LỌC THEO THỜI GIAN (Ngày tạo) ---
  @ApiPropertyOptional({
    description: 'Ngày tạo từ (YYYY-MM-DD)',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày tạo đến (YYYY-MM-DD)',
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  // --- 4. LỌC THEO DOANH SỐ (Tổng mua) ---
  @ApiPropertyOptional({ description: 'Tổng doanh số mua hàng TỪ (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRevenue?: number;

  @ApiPropertyOptional({ description: 'Tổng doanh số mua hàng ĐẾN (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRevenue?: number;

  // --- 5. LỌC THEO CÔNG NỢ (Nợ hiện tại) ---
  @ApiPropertyOptional({ description: 'Nợ hiện tại TỪ (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minDebt?: number; // Không để Min(0) vì có thể nợ âm (trả thừa)

  @ApiPropertyOptional({ description: 'Nợ hiện tại ĐẾN (VNĐ)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxDebt?: number;
}
