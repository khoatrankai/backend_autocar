import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl()
  avatar_url?: string;

  // Lưu ý: Không cho phép update 'role' ở đây vì lý do bảo mật.
  // Việc set Role (Admin/Sale) phải dùng API riêng dành cho Admin.
}
