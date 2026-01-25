import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ====================================================================
  // LẤY DANH SÁCH NHÂN VIÊN (STAFFS)
  // ====================================================================
  async findAllStaffs() {
    // Lấy tất cả profile từ bảng 'profiles'
    // Bạn có thể thêm điều kiện 'where' nếu muốn lọc role cụ thể (VD: role != 'customer')
    const staffs = await this.prisma.profiles.findMany({
      select: {
        id: true,
        full_name: true,
        role: true,
        phone_number: true,
        avatar_url: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return staffs;
  }

  // ====================================================================
  // LẤY CHI TIẾT 1 NHÂN VIÊN (Optional)
  // ====================================================================
  async findOne(id: string) {
    return await this.prisma.profiles.findUnique({
      where: { id },
    });
  }
}
