import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum WarehouseType {
  MAIN = 'main',
  BRANCH = 'branch',
}

export class CreateWarehouseDto {
  @ApiProperty({ example: 'Kho Tổng TP.HCM' })
  @IsString()
  name: string;

  @ApiProperty({ enum: WarehouseType, example: WarehouseType.MAIN })
  @IsEnum(WarehouseType)
  type: WarehouseType;

  @ApiProperty({ example: '123 QL1A, Bình Tân', required: false })
  @IsOptional()
  @IsString()
  address?: string;
}
