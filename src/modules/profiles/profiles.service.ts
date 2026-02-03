import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  // ====================================================================
  // LẤY DANH SÁCH NHÂN VIÊN (STAFFS)
  // ====================================================================
  async findAllSales(role: string) {
    // Lấy tất cả profile từ bảng 'profiles'
    // Bạn có thể thêm điều kiện 'where' nếu muốn lọc role cụ thể (VD: role != 'customer')
    const staffs = await this.prisma.profiles.findMany({
      select: {
        id: true,
        full_name: true,
        phone_number: true,
        avatar_url: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      where: {
        role: role,
      },
    });

    return staffs;
  }
}
