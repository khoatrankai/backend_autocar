import { ApiProperty } from '@nestjs/swagger';

export class ProductEntity {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: '464200D131' })
  sku: string;

  @ApiProperty({ example: 'Má phanh trước Vios' })
  name: string;

  @ApiProperty({ example: 'OEM-999', nullable: true, required: false })
  oemCode: string | null;

  @ApiProperty({ example: 'Toyota', nullable: true, required: false })
  brand: string | null;

  @ApiProperty({ example: 'Bộ', default: 'Cái' })
  unit: string | null;

  @ApiProperty({ example: 450000, description: 'Giá vốn (Cost Price)' })
  costPrice: number;

  @ApiProperty({ example: 850000, description: 'Giá bán lẻ (Retail Price)' })
  retailPrice: number;

  @ApiProperty({ example: 10, description: 'Cảnh báo tồn kho tối thiểu' })
  minStockAlert: number;

  @ApiProperty({
    example: 'https://img.com/product.jpg',
    nullable: true,
    required: false,
  })
  imageUrl: string | null;

  @ApiProperty({ example: 5, nullable: true, description: 'ID danh mục' })
  categoryId: number | null;

  @ApiProperty()
  createdAt: Date;
}
