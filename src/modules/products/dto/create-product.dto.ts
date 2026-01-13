import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  IsNotEmpty,
  ValidateNested,
  IsArray,
  IsUrl,
} from 'class-validator';

// 1. DTO cho dòng xe tương thích (Con)
class ProductCompatibilityDto {
  @ApiProperty({ example: 'Toyota', description: 'Hãng xe' })
  @IsString()
  @IsNotEmpty()
  car_make: string;

  @ApiProperty({ example: 'Vios', description: 'Dòng xe' })
  @IsString()
  @IsNotEmpty()
  car_model: string;

  @ApiProperty({
    example: 2018,
    required: false,
    description: 'Đời xe bắt đầu',
  })
  @IsOptional()
  @IsInt()
  @Min(1900)
  year_start?: number;

  @ApiProperty({
    example: 2022,
    required: false,
    description: 'Đời xe kết thúc',
  })
  @IsOptional()
  @IsInt()
  @Min(1900)
  year_end?: number;
}

// 2. DTO cho phần Tồn kho ban đầu (Con)
class InitialInventoryDto {
  @ApiProperty({ example: 1, description: 'ID của Kho' })
  @IsInt()
  @IsNotEmpty()
  warehouse_id: number;

  @ApiProperty({ example: 100, description: 'Số lượng nhập ban đầu' })
  @IsInt()
  @Min(0)
  quantity: number;
}

// 3. DTO Chính: Tạo sản phẩm (Cập nhật theo Schema mới)
export class CreateProductDto {
  // --- THÔNG TIN ĐỊNH DANH ---
  @ApiProperty({
    example: '464200D131',
    description: 'Mã phụ tùng (Unique SKU)',
  })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({
    example: 'OEM-999-888',
    description: 'Mã OEM (Mã gốc)',
    required: false,
  })
  @IsOptional()
  @IsString()
  oem_code?: string;

  @ApiProperty({
    example: 'Rotuyn lái ngoài Toyota Vios',
    description: 'Tên sản phẩm',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  // --- PHÂN LOẠI & NHÀ CUNG CẤP ---
  @ApiProperty({
    example: 'Toyota',
    description: 'Thương hiệu',
    required: false,
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ example: 1, description: 'ID Danh mục', required: false })
  @IsOptional()
  @IsInt()
  category_id?: number;

  @ApiProperty({
    example: 1,
    description: 'ID Nhà cung cấp (Mới thêm)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  supplier_id?: number;

  // --- QUY CÁCH & HÌNH ẢNH ---
  @ApiProperty({ example: 'Cái', description: 'Đơn vị tính', required: false })
  @IsOptional()
  @IsString()
  unit?: string; // Schema có default('Cái') nên để optional

  @ApiProperty({
    example: 'https://domain.com/image.jpg',
    description: 'Link ảnh sản phẩm (String)',
    required: false,
  })
  @IsOptional()
  @IsString()
  // @IsUrl() // Bỏ comment nếu muốn validate đúng định dạng URL
  image_url?: string;

  // --- GIÁ CẢ (Schema dùng Decimal -> DTO dùng Number) ---
  @ApiProperty({ example: 150000, description: 'Giá vốn', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @ApiProperty({ example: 250000, description: 'Giá bán lẻ', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  retail_price?: number;

  // --- CẤU HÌNH KHO ---
  @ApiProperty({
    example: 5,
    description: 'Mức cảnh báo tồn kho tối thiểu',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  min_stock_alert?: number;

  // --- MẢNG CON (Nhập cùng lúc - Không thay đổi so với DB nhưng cần cho Service xử lý) ---
  @ApiProperty({
    type: [ProductCompatibilityDto],
    required: false,
    description: 'Danh sách xe tương thích',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductCompatibilityDto)
  compatibility?: ProductCompatibilityDto[];

  @ApiProperty({
    type: [InitialInventoryDto],
    required: false,
    description: 'Nhập kho ban đầu (nếu có)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialInventoryDto)
  inventory?: InitialInventoryDto[];
}
