import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Hệ thống gầm' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'he-thong-gam', required: false })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'ID danh mục cha (nếu có)',
  })
  @IsOptional()
  @IsNumber()
  parent_id?: number;
}
