import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseItemDto {
  @ApiProperty()
  @IsNumber()
  product_id: number;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  import_price: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({
    description: 'Mã phiếu nhập (Tự sinh nếu bỏ trống)',
    required: false,
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty()
  @IsNumber()
  supplier_id: number;

  @ApiProperty()
  @IsNumber()
  warehouse_id: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  paid_amount?: number; // Số tiền trả ngay cho NCC

  @ApiProperty()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description:
      'Trạng thái phiếu: draft (lưu tạm) hoặc completed (hoàn thành)',
    default: 'completed',
    required: false,
  })
  @IsOptional()
  @IsString()
  // Nếu muốn chặt chẽ hơn thì dùng @IsEnum(['draft', 'completed', 'cancelled'])
  status?: string;

  @ApiProperty({
    description:
      'ID nhân viên phụ trách (Nếu bỏ trống sẽ lấy User đang đăng nhập)',
    required: false,
  })
  @IsOptional()
  staff_id?: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
