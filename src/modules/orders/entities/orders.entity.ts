import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from 'src/common/enums';

export class OrderEntity {
  @ApiProperty({ example: 500 })
  id: number;

  @ApiProperty({ example: 'DH-20240101-001' })
  code: string;

  @ApiProperty({ example: 1, description: 'ID Khách hàng' })
  partnerId: number | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID Nhân viên sale',
  })
  staffId: string | null;

  @ApiProperty({ example: 1, description: 'ID Kho xuất' })
  warehouseId: number | null;

  @ApiProperty({ example: 5000000, description: 'Tổng tiền hàng' })
  totalAmount: number;

  @ApiProperty({ example: 100000, description: 'Chiết khấu' })
  discount: number;

  @ApiProperty({ example: 4900000, description: 'Thành tiền cuối cùng' })
  finalAmount: number;

  @ApiProperty({ example: 2000000, description: 'Đã thanh toán' })
  paidAmount: number;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.COMPLETED })
  status: OrderStatus;

  @ApiProperty({
    example: 'Giao giờ hành chính',
    nullable: true,
    required: false,
  })
  note: string | null;

  @ApiProperty()
  createdAt: Date;
}
