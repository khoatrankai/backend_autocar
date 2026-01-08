import { ApiProperty, PickType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
  IsNotEmpty,
} from 'class-validator';

// --- ENUMS ---
export enum PartnerType {
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
}

export enum PartnerStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

// --- STANDARD CREATE DTO ---
export class CreatePartnerDto {
  @ApiProperty({ example: 'KH001', description: 'Mã đối tác (Duy nhất)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Gara Ô tô Tuấn Phát' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '0912345678', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'contact@gara-tuanphat.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '123 Phạm Văn Đồng, Hà Nội', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ enum: PartnerType, default: PartnerType.CUSTOMER })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType = PartnerType.CUSTOMER;

  @ApiProperty({ example: 'Khách VIP', required: false })
  @IsOptional()
  @IsString()
  group_name?: string;

  @ApiProperty({
    example: 'uuid-string',
    required: false,
    description: 'Nhân viên phụ trách',
  })
  @IsOptional()
  @IsUUID()
  assigned_staff_id?: string;

  @ApiProperty({ enum: PartnerStatus, default: PartnerStatus.ACTIVE })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus = PartnerStatus.ACTIVE;

  @ApiProperty({ example: 20000000, required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debt_limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

// --- 2. QUICK CREATE DTO ---
// Chỉ lấy các trường cần thiết, các trường khác sẽ tự động xử lý ở Service
export class QuickCreatePartnerDto extends PickType(CreatePartnerDto, [
  'name',
  'phone',
  'address',
] as const) {
  // Ghi đè type nếu muốn mặc định là Customer trong Swagger, dù Service sẽ hardcode
  @ApiProperty({ enum: PartnerType, default: PartnerType.CUSTOMER })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType = PartnerType.CUSTOMER;
}

// --- 3. ASSIGN STAFF DTO ---
export class AssignPartnerDto {
  @ApiProperty({
    description: 'UUID của nhân viên sales cần gán',
    example: 'uuid-v4',
  })
  @IsUUID()
  @IsNotEmpty()
  staff_id: string;
}

// --- 4. UPDATE STATUS DTO ---
export class UpdatePartnerStatusDto {
  @ApiProperty({ enum: PartnerStatus, description: 'Trạng thái mới' })
  @IsEnum(PartnerStatus)
  @IsNotEmpty()
  status: PartnerStatus;
}
