import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';

// Định nghĩa Enum
export enum PartnerType {
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
}

export enum PartnerStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

export class CreatePartnerDto {
  @ApiProperty({
    example: 'KH001',
    description: 'Mã đối tác (Duy nhất). VD: KH001, NCC002',
  })
  @IsString()
  code: string;

  @ApiProperty({
    example: 'Gara Ô tô Tuấn Phát',
    description: 'Tên đầy đủ của khách hàng hoặc nhà cung cấp',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: '0912345678',
    required: false,
    description: 'Số điện thoại liên hệ',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'contact@gara-tuanphat.com',
    required: false,
    description: 'Địa chỉ Email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '123 Phạm Văn Đồng, Hà Nội',
    required: false,
    description: 'Địa chỉ giao hàng/trụ sở',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    enum: PartnerType,
    default: PartnerType.CUSTOMER,
    example: PartnerType.CUSTOMER,
    required: false,
    description:
      'Loại đối tác: customer (Khách hàng) hoặc supplier (Nhà cung cấp)',
  })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType = PartnerType.CUSTOMER;

  @ApiProperty({
    example: 'Khách VIP',
    required: false,
    description: 'Nhóm khách hàng (Gara, Khách lẻ, Đại lý...)',
  })
  @IsOptional()
  @IsString()
  group_name?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
    description: 'UUID của nhân viên sales phụ trách khách này',
  })
  @IsOptional()
  @IsUUID()
  assigned_staff_id?: string;

  @ApiProperty({
    enum: PartnerStatus,
    default: PartnerStatus.ACTIVE,
    example: PartnerStatus.ACTIVE,
    required: false,
    description: 'Trạng thái hoạt động',
  })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus = PartnerStatus.ACTIVE;

  @ApiProperty({
    example: 20000000,
    required: false,
    description: 'Hạn mức công nợ cho phép (VNĐ)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debt_limit?: number;

  @ApiProperty({
    example: 'Khách khó tính, yêu cầu gọi trước khi giao',
    required: false,
    description: 'Ghi chú nội bộ',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
