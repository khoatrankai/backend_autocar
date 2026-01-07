import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsUUID,
} from 'class-validator';

export enum TransactionType {
  RECEIPT = 'receipt', // Thu
  PAYMENT = 'payment', // Chi
}

export class CreateTransactionDto {
  @ApiProperty({ example: 'PT-20240101-01', description: 'Mã phiếu thu/chi' })
  @IsString()
  code: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.RECEIPT })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 5000000, description: 'Số tiền' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'cash', required: false })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiProperty({
    example: 1,
    description: 'ID Loại thu chi (Transaction Category)',
  })
  @IsNumber()
  category_id: number;

  @ApiProperty({
    example: 5,
    required: false,
    description: 'ID Đối tác (nếu thanh toán công nợ)',
  })
  @IsOptional()
  @IsNumber()
  partner_id?: number;

  @ApiProperty({
    example: 100,
    required: false,
    description: 'ID Đơn hàng (nếu thu tiền đơn)',
  })
  @IsOptional()
  @IsNumber()
  order_id?: number;

  @ApiProperty({ description: 'UUID nhân viên lập phiếu' })
  @IsUUID()
  staff_id: string;

  @ApiProperty({ example: 'Thu tiền đơn hàng KH001', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
