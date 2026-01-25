import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReturnItemDto {
  @ApiProperty({ example: 101 })
  @IsNumber()
  product_id: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    example: 400000,
    description: 'Giá trị hoàn lại cho sản phẩm này',
  })
  @IsNumber()
  refund_price: number;
}

export class CreateReturnDto {
  @ApiProperty({ example: 'TH-20240101-01' })
  @IsString()
  code: string;

  @ApiProperty({ example: 500, description: 'ID Đơn hàng gốc' })
  @IsOptional()
  order_id?: number | string;

  @ApiProperty({ example: 5, description: 'ID Khách hàng' })
  @IsNumber()
  partner_id: number;

  @ApiProperty({ example: 'Sản phẩm bị lỗi kỹ thuật', required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}
