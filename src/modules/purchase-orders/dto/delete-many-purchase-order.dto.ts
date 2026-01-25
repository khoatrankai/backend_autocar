// src/modules/purchase-orders/dto/delete-many-purchase-order.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class DeleteManyPurchaseOrdersDto {
  @ApiProperty({
    description: 'Danh sách ID các phiếu nhập cần xóa',
    example: [1, 2, 3],
    type: [Number], // Hoặc String tùy vào cách bạn gửi BigInt từ FE
  })
  @IsArray()
  @IsNotEmpty()
  ids: number[]; // Nhận vào là number hoặc string đều được, service sẽ convert sang BigInt
}
