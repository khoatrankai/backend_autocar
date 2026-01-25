import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum StockStatus {
  ALL = 'all',
  IN_STOCK = 'in_stock', // Còn hàng (quantity > 0)
  OUT_OF_STOCK = 'out_of_stock', // Hết hàng (quantity <= 0)
  LOW_STOCK = 'low_stock', // Dưới định mức
  OVER_STOCK = 'over_stock', // Vượt định mức
}

export enum DateRangeType {
  ALL = 'all',
  CUSTOM = 'custom',
}

export class DateRangeDto {
  @ApiProperty({ required: false, example: '2025-01-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ required: false, example: '2025-12-31' })
  @IsOptional()
  @IsString()
  to?: string;
}

export class FilterProductDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Tìm theo Tên hoặc SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  // --- CÁC TRƯỜNG MỚI DỰA THEO ẢNH ---

  @ApiProperty({ required: false, description: 'Lọc theo ID Nhóm hàng' })
  @IsOptional()
  @Type(() => Number) // Nhận vào number, sẽ convert sang BigInt trong Service
  categoryId?: number;

  @ApiProperty({ required: false, description: 'Lọc theo ID Nhà cung cấp' })
  @IsOptional()
  @Type(() => Number)
  supplierId?: number;

  @ApiProperty({
    required: false,
    enum: StockStatus,
    description: 'Trạng thái tồn kho: all, in_stock, out_of_stock',
  })
  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  @ApiProperty({
    required: false,
    description: 'Lọc theo Thương hiệu (Tìm trong bảng Xe tương thích)',
  })
  @IsOptional()
  @IsString()
  brand?: string; // Tương ứng với car_make trong product_compatibility

  @ApiProperty({ required: false, description: 'Lọc theo Vị trí kho' })
  @IsOptional()
  @IsString()
  location?: string; // Tương ứng với location_code trong inventory

  @ApiProperty({ required: false, description: 'Ngày tạo từ (ISO String)' })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiProperty({ required: false, description: 'Ngày tạo đến (ISO String)' })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;
}

export class FilterAdvanceProductDto {
  // --- PHÂN TRANG & TÌM KIẾM ---
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Tìm theo Tên, SKU, Code' })
  @IsOptional()
  @IsString()
  search?: string;

  // --- CÁC BỘ LỌC MẢNG (MULTI-SELECT) ---

  // Chú ý: Nhận string[] để tương thích với BigInt ID
  @ApiProperty({
    required: false,
    type: [String],
    description: 'Mảng ID Nhóm hàng',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    // Hỗ trợ query param dạng ?categoryIds=1,2,3
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  categoryIds?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Mảng ID Nhà cung cấp',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  supplierIds?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Mảng Tên Thương hiệu',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  brandIds?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Mảng Mã Vị trí (Location Code)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  locationIds?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Mảng Loại sản phẩm (goods, service...)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  productTypes?: string[];

  // --- TRẠNG THÁI TỒN KHO ---
  @ApiProperty({ required: false, enum: StockStatus, default: StockStatus.ALL })
  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus = StockStatus.ALL;

  // --- DỰ KIẾN HẾT HÀNG ---
  @ApiProperty({
    required: false,
    enum: DateRangeType,
    default: DateRangeType.ALL,
  })
  @IsOptional()
  @IsEnum(DateRangeType)
  stockoutDateType?: DateRangeType = DateRangeType.ALL;

  @ApiProperty({
    required: false,
    description: 'Dự kiến hết hàng: Từ ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  stockoutFrom?: string; // Đổi tên rõ ràng

  @ApiProperty({
    required: false,
    description: 'Dự kiến hết hàng: Đến ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  stockoutTo?: string; // Đổi tên rõ ràng

  // 2. THỜI GIAN TẠO
  @ApiProperty({
    required: false,
    enum: DateRangeType,
    default: DateRangeType.ALL,
  })
  @IsOptional()
  @IsEnum(DateRangeType)
  createdDateType?: DateRangeType = DateRangeType.ALL;

  @ApiProperty({
    required: false,
    description: 'Ngày tạo: Từ ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string; // Đổi tên rõ ràng

  @ApiProperty({
    required: false,
    description: 'Ngày tạo: Đến ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string; // Đổi tên rõ ràng
}
