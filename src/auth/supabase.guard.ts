/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // --- THÊM LOG DEBUG TẠI ĐÂY ---
    const authHeader = request.headers.authorization;
    console.log('------------------------------------------------');
    console.log(
      '🔍 [GUARD] 1. Auth Header nhận được:',
      authHeader ? `${authHeader.substring(0, 20)}...` : 'KHÔNG CÓ',
    );
    const token = this.extractTokenFromHeader(request);
    // -----------------------------

    if (!token) {
      throw new UnauthorizedException('Thiếu Token');
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.getClient().auth.getUser(token);

      if (error || !user) {
        // Log luôn lỗi từ Supabase xem nó kêu gì
        console.log('3. Lỗi từ Supabase:', error?.message);
        throw new UnauthorizedException('Invalid token');
      }

      request['user'] = user;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    // Logic này tách chuỗi dựa trên khoảng trắng
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
