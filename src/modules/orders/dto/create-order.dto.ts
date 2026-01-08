import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

// 1. DTO cho từng sản phẩm trong giỏ hàng
export class CreateOrderItemDto {
  @ApiProperty({ example: 5, description: 'ID sản phẩm' })
  @IsNotEmpty()
  @IsNumber()
  product_id: number;

  @ApiProperty({ example: 2, description: 'Số lượng mua', minimum: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 150000,
    description: 'Giá bán tại thời điểm tạo đơn (VNĐ)',
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;
}

// 2. DTO chính cho việc tạo đơn hàng
export class CreateOrderDto {
  @ApiPropertyOptional({
    example: 'ORD2024001',
    description: 'Mã đơn hàng (Nếu không truyền sẽ tự sinh)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 10, description: 'ID Khách hàng' })
  @IsNotEmpty()
  @IsNumber()
  partner_id: number;

  @ApiProperty({
    example: 2,
    description: 'ID Kho hàng xuất bán (Kho Tổng/Chi nhánh)',
  })
  @IsNotEmpty()
  @IsNumber()
  warehouse_id: number;

  @ApiPropertyOptional({
    example: 'uuid-nhan-vien',
    description: 'ID Nhân viên sale (Nếu admin tạo hộ)',
  })
  @IsOptional()
  @IsUUID()
  staff_id?: string;

  @ApiPropertyOptional({
    example: 'Giao hàng giờ hành chính',
    description: 'Ghi chú đơn hàng',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    type: [CreateOrderItemDto],
    description: 'Danh sách sản phẩm',
    example: [{ product_id: 5, quantity: 2, price: 150000 }],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true }) // Validate từng object bên trong mảng
  @Type(() => CreateOrderItemDto) // Map JSON object sang Class DTO
  items: CreateOrderItemDto[];
}
