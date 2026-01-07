import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PartnerType } from './create-partner.dto';

export class FilterPartnerDto {
  @IsOptional()
  @IsString()
  search?: string; // Tìm theo tên, mã hoặc số điện thoại

  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType; // Lọc riêng Khách hàng hoặc NCC
}
