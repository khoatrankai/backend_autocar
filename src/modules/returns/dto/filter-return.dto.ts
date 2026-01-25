// src/modules/returns/dto/filter-return.dto.ts
import { IsOptional, IsString, IsArray } from 'class-validator';

export class FilterReturnDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  search?: string; // Tìm theo mã phiếu trả hoặc tên đối tác

  @IsOptional()
  branchIds?: string | string[]; // Filter theo Chi nhánh (Kho)

  @IsOptional()
  status?: string | string[]; // Filter theo Trạng thái (Phiếu tạm, Đã trả...)

  @IsOptional()
  startDate?: string; // Filter Thời gian từ

  @IsOptional()
  endDate?: string; // Filter Thời gian đến

  @IsOptional()
  creatorIds?: string | string[]; // Filter Người tạo

  @IsOptional()
  partnerIds?: string | string[]; // Filter Người trả (Nhà cung cấp/Khách hàng)
}
