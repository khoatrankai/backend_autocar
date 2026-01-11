import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
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

  async remove(id: string) {
    // 1. Kiểm tra xem user có tồn tại trong Prisma không (Optional)
    const user = await this.prisma.profiles.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    // 2. Gọi Supabase Admin để xóa khỏi hệ thống Auth
    // Lưu ý: Nếu bạn đã setup ON DELETE CASCADE trong SQL, profile sẽ tự mất.
    const { error } = await this.supabaseService
      .getAdminClient() // Bắt buộc dùng Admin Client
      .auth.admin.deleteUser(id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    // 3. (Optional) Nếu Database không tự cascade, xóa thủ công:
    // try {
    //   await this.prisma.profiles.delete({ where: { id } });
    // } catch (e) {
    //   // Xử lý lỗi nếu user dính ràng buộc khóa ngoại (đã tạo đơn hàng)
    //   throw new BadRequestException('Không thể xóa nhân viên đã có phát sinh dữ liệu (Đơn hàng/Khách hàng). Hãy dùng tính năng Khóa.');
    // }

    return { message: 'Xóa người dùng vĩnh viễn thành công' };
  }

  // ----------------------------------------------------------------
  // 4. Khóa tài khoản (Soft Delete / Ban) - KHUYÊN DÙNG
  // User sẽ không đăng nhập được nữa, nhưng dữ liệu lịch sử vẫn còn.
  // ----------------------------------------------------------------
  async banUser(id: string) {
    // 1. Cập nhật trong Supabase Auth (Chặn đăng nhập)
    const { error } = await this.supabaseService
      .getAdminClient()
      .auth.admin.updateUserById(id, {
        ban_duration: '876600h', // Ban 100 năm (coi như vĩnh viễn)
      });

    if (error) {
      throw new BadRequestException(error.message);
    }

    // 2. Cập nhật trạng thái trong Prisma (để hiện lên UI là đã khóa)
    // Giả sử bảng profiles của bạn có cột `status` hoặc `is_active`
    /*
    await this.prisma.profiles.update({
      where: { id },
      data: { role: 'banned' } // Hoặc cột status: 'locked'
    });
    */

    return { message: 'Đã khóa tài khoản thành công' };
  }
}
