import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PartnerType } from './create-partner.dto';

export class FilterPartnerDto {
  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên, mã hoặc số điện thoại',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: PartnerType,
    description: 'Lọc theo loại đối tác',
  })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType;

  @ApiPropertyOptional({ default: 1, description: 'Số trang hiện tại' })
  @IsOptional()
  @Type(() => Number) // Chuyển đổi query param từ string sang number
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
}
