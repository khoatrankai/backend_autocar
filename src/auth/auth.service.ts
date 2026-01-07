import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { SupabaseService } from 'src/supabase/supabase.service';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  // 1. Đăng ký tài khoản mới (Dùng quyền Admin để xác thực luôn)
  async register(registerDto: RegisterDto) {
    // --- SỬA 1: Lấy thêm phone_number từ DTO ---
    const { email, password, full_name, phone_number, role } = registerDto;

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name,
          role,
          // --- SỬA 2: Truyền phone_number vào đây để Trigger SQL hứng ---
          phone_number: phone_number || '',
          avatar_url: '',
        },
      });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Đăng ký thành công!',
      user: data.user,
    };
  }

  // 2. Đăng nhập
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // A. Gọi Supabase để xác thực Email/Pass
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // B. QUAN TRỌNG: Lấy thông tin Role chuẩn từ bảng Profiles
    // Vì Auth metadata có thể không cập nhật kịp hoặc không chứa role chuẩn
    const profile = await this.prisma.profiles.findUnique({
      where: { id: data.user.id }, // ID user từ Supabase khớp với ID trong Profiles
      select: { role: true, full_name: true, phone_number: true },
    });
    return {
      message: 'Đăng nhập thành công',
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        // Lấy dữ liệu từ bảng Profile (Source of Truth)
        full_name: profile?.full_name || '',
        phone_number: profile?.phone_number || '',
        role: profile?.role || 'sale', // <--- Giờ nó sẽ lấy đúng role từ DB
      },
    };
  }
}
