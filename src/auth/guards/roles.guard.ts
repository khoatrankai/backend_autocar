import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Lấy danh sách role yêu cầu (VD: ['admin']) từ Decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu API không yêu cầu role gì đặc biệt -> Cho qua luôn
    if (!requiredRoles) {
      return true;
    }

    // 2. Lấy thông tin User từ Request (Đã được AuthGuard giải mã từ Token)
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.id) {
      return false; // Chưa đăng nhập
    }

    // 3. QUAN TRỌNG: Query DB để lấy Role mới nhất
    // (Không tin tưởng role trong Token vì có thể cũ)
    const profile = await this.prisma.profiles.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!profile || !profile.role) {
      throw new ForbiddenException(
        'Tài khoản không tồn tại hoặc chưa được phân quyền',
      );
    }

    // 4. Kiểm tra xem role của user có nằm trong danh sách cho phép không
    const hasRole = requiredRoles.includes(profile.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Bạn cần quyền [${requiredRoles.join(', ')}] để thực hiện thao tác này`,
      );
    }

    return true;
  }
}
