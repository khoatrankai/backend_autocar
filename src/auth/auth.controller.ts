import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, UserRole } from './dto/auth.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseGuard } from './supabase.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  getProfile(@Request() req) {
    // req.user là cái mà Guard đã gắn vào ở Bước 2
    console.log(req.user);
    return {
      message: 'Lấy thông tin thành công',
      user: req.user,
    };
  }

  @Delete(':id')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard, RolesGuard) // Chạy AuthGuard trước để lấy user, rồi chạy RolesGuard
  @Roles(UserRole.ADMIN) // <--- Chỉ định: Phải là ADMIN mới được vào
  remove(@Param('id') id: string) {
    return this.authService.remove(id);
  }

  @Patch('ban/:id')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard, RolesGuard) // Chạy AuthGuard trước để lấy user, rồi chạy RolesGuard
  @Roles(UserRole.ADMIN) // <--- Chỉ định: Phải là ADMIN mới được vào
  banUser(@Param('id') id: string) {
    return this.authService.banUser(id);
  }
}
