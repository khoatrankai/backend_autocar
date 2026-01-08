import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInventoryDto {
  @ApiProperty({ example: 1, description: 'ID của sản phẩm cần kiểm tra' })
  @IsNotEmpty({ message: 'Product ID không được để trống' })
  @Type(() => Number) // Convert string query param to number
  @IsNumber()
  product_id: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID kho hiện tại (để ưu tiên hiển thị hoặc lọc)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  warehouse_id?: number;
}
