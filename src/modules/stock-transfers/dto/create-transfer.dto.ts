import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// 1. DTO cho từng món hàng trong danh sách
export class TransferItemDto {
  @IsNotEmpty({ message: 'Product ID không được để trống' })
  product_id: number | string; // Chấp nhận cả string/number để tiện convert BigInt

  @IsNumber()
  @Min(1, { message: 'Số lượng chuyển phải lớn hơn 0' })
  quantity: number;
}

// 2. DTO Tạo phiếu chuyển (Gửi đi)
export class CreateTransferDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsNotEmpty({ message: 'Kho gửi không được để trống' })
  from_warehouse_id: number | string;

  @IsNotEmpty({ message: 'Kho nhận không được để trống' })
  to_warehouse_id: number | string;

  @IsNotEmpty({ message: 'Người giao không được để trống' })
  staff_id: number | string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  // Status mặc định backend tự set là 'pending' nên không cần truyền
}

// 3. DTO Từ chối phiếu (Bắt buộc có lý do)
export class RejectTransferDto {
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @IsString()
  reason: string;
}
