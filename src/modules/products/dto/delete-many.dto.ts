import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class DeleteManyDto {
  @ApiProperty({ type: [Number], description: 'Danh sách ID cần xóa' })
  @IsArray()
  @IsNotEmpty()
  ids: number[]; // Hoặc string[] nếu bạn dùng UUID
}
