import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
export enum UserRole {
  ADMIN = 'admin',
  SALE = 'sale',
  WAREHOUSE = 'warehouse',
  ACCOUNTANT = 'accountant',
}
export class RegisterDto {
  @ApiProperty({ example: 'khoa@gmail.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  // --- SỬA Ở ĐÂY: Đổi sang snake_case ---
  @ApiProperty({ example: 'Nguyen Van Khoa' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  full_name: string;

  @ApiProperty({ example: '0909123456', required: false })
  @IsOptional()
  @IsString()
  // Regex đơn giản cho SĐT Việt Nam (tùy chọn)
  @Matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/g, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone_number?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SALE, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'khoa@gmail.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;
}
