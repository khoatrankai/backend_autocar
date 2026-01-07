import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { FilterPartnerDto } from './dto/filter-partner.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  // 1. Tạo mới Partner
  async create(dto: CreatePartnerDto) {
    try {
      return await this.prisma.partners.create({
        data: {
          code: dto.code,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          type: dto.type,
          group_name: dto.group_name,
          assigned_staff_id: dto.assigned_staff_id,
          status: dto.status,
          debt_limit: dto.debt_limit, // Prisma tự map number -> Decimal
          notes: dto.notes,
          // Các trường số liệu mặc định là 0
          current_debt: 0,
          total_revenue: 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Mã lỗi P2002: Unique constraint failed (Trùng mã code)
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Mã khách hàng '${dto.code}' đã tồn tại.`,
          );
        }
      }
      throw error;
    }
  }

  // 2. Lấy danh sách (Có tìm kiếm & Phân trang)
  async findAll(filter: FilterPartnerDto) {
    const { search, type } = filter;

    const whereCondition: Prisma.partnersWhereInput = {
      // Nếu có type thì lọc, không thì bỏ qua
      ...(type && { type }),

      // Logic tìm kiếm: (Tên chứa từ khóa) HOẶC (SĐT chứa từ khóa) HOẶC (Mã chứa từ khóa)
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const partners = await this.prisma.partners.findMany({
      where: whereCondition,
      include: {
        profiles: {
          // Join bảng profiles để lấy tên nhân viên phụ trách
          select: { full_name: true, phone_number: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return partners;
  }

  // 3. Xem chi tiết
  async findOne(id: number) {
    const partner = await this.prisma.partners.findUnique({
      where: { id: BigInt(id) }, // Convert number -> BigInt
      include: {
        profiles: { select: { full_name: true } },
        orders: {
          // Lấy 5 đơn hàng gần nhất (Lịch sử mua hàng)
          take: 5,
          orderBy: { created_at: 'desc' },
          select: {
            code: true,
            total_amount: true,
            status: true,
            created_at: true,
          },
        },
      },
    });

    if (!partner)
      throw new NotFoundException(`Không tìm thấy đối tác có ID: ${id}`);
    return partner;
  }

  // 4. Cập nhật
  async update(id: number, dto: UpdatePartnerDto) {
    // Kiểm tra tồn tại trước
    await this.findOne(id);

    try {
      return await this.prisma.partners.update({
        where: { id: BigInt(id) },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Mã khách hàng '${dto.code}' đã tồn tại.`);
      }
      throw error;
    }
  }

  // 5. Xóa (Khuyên dùng: Khóa tài khoản thay vì xóa vĩnh viễn)
  async remove(id: number) {
    await this.findOne(id);

    // Cách 1: Xóa cứng (Nếu chưa có ràng buộc khóa ngoại phức tạp)
    // return this.prisma.partners.delete({ where: { id: BigInt(id) } });

    // Cách 2: Xóa mềm (An toàn cho ERP) -> Chuyển status thành 'locked'
    return this.prisma.partners.update({
      where: { id: BigInt(id) },
      data: { status: 'locked' },
    });
  }
}
