import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// 1. Định nghĩa DTO con trước (Item trong đơn hàng)
export class OrderItemDto {
  @ApiProperty({
    example: 101,
    description: 'ID của sản phẩm trong kho',
  })
  @IsNumber()
  product_id: number;

  @ApiProperty({
    example: 2,
    description: 'Số lượng mua',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 450000,
    description: 'Đơn giá bán tại thời điểm tạo đơn (VNĐ)',
  })
  @IsNumber()
  @Min(0)
  price: number;
}

// 2. Định nghĩa DTO cha (Đơn hàng)
export class CreateOrderDto {
  @ApiProperty({
    example: 'DH-20240105-001',
    description: 'Mã đơn hàng (Duy nhất)',
  })
  @IsString()
  code: string;

  @ApiProperty({
    example: 5,
    description: 'ID của Khách hàng (Partner)',
  })
  @IsNumber()
  partner_id: number;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
    description:
      'UUID của nhân viên tạo đơn (Nếu hệ thống không tự lấy từ Token)',
  })
  @IsOptional()
  @IsUUID()
  staff_id?: string;

  @ApiProperty({
    type: [OrderItemDto], // <--- QUAN TRỌNG: Khai báo đây là mảng các OrderItemDto
    description: 'Danh sách sản phẩm trong đơn hàng',
    example: [
      { product_id: 101, quantity: 2, price: 450000 },
      { product_id: 205, quantity: 1, price: 1200000 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true }) // Validate từng item trong mảng
  @Type(() => OrderItemDto) // Transform JSON thành class OrderItemDto
  items: OrderItemDto[];
}
