import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CreatePartnerDto,
  QuickCreatePartnerDto,
} from './dto/create-partner.dto'; // Đã thêm QuickCreate DTO
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { FilterPartnerDto } from './dto/filter-partner.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';

// Interface giả định cho User (lấy từ request)
interface UserPayload {
  id: string; // UUID
  role: 'admin' | 'accountant' | 'sale' | 'warehouse';
}

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  // 1. Tạo mới Partner (Standard)
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
          status: dto.status || 'active',
          debt_limit: dto.debt_limit || 0,
          notes: dto.notes,
          current_debt: 0,
          total_revenue: 0,
        },
      });
    } catch (error) {
      this.handlePrismaError(error, dto.code);
    }
  }

  // 1.1. Tạo khách hàng nhanh (Quick Create)
  // Logic: Tự gán staff, mặc định status active, debt_limit 10tr
  async createQuick(dto: QuickCreatePartnerDto, user: UserPayload) {
    // Tự sinh mã nếu không có (Ví dụ đơn giản: KH + Timestamp)
    const generatedCode = `KH${Date.now().toString().slice(-6)}`;

    try {
      return await this.prisma.partners.create({
        data: {
          code: generatedCode, // Hoặc logic sinh mã riêng
          name: dto.name,
          phone: dto.phone,
          address: dto.address,
          type: 'customer', // Luôn là customer
          assigned_staff_id: user.id, // Tự động gán cho nhân viên tạo
          status: 'active', // Mặc định Active
          debt_limit: 10000000, // Mặc định 10 triệu (có thể lấy từ ConfigService)

          // Các trường khác để null hoặc 0
          current_debt: 0,
          total_revenue: 0,
        },
      });
    } catch (error) {
      // Xử lý lỗi trùng lặp số điện thoại nếu cần
      throw error;
    }
  }

  // 2. Lấy danh sách (Phân trang + Phân quyền)
  async findAll(filter: FilterPartnerDto, user: UserPayload) {
    const { search, type, page = 1, limit = 10 } = filter;

    const skip = (page - 1) * limit;

    // --- LOGIC PHÂN QUYỀN (RLS tại tầng Application) ---
    let roleCondition: Prisma.partnersWhereInput = {};

    if (user.role === 'sale') {
      // Sale chỉ thấy khách của mình HOẶC khách chưa ai phụ trách (khách chung)
      roleCondition = {
        OR: [{ assigned_staff_id: user.id }, { assigned_staff_id: null }],
      };
    }
    // Admin/Kế toán: roleCondition rỗng -> Xem tất cả

    // --- ĐIỀU KIỆN TÌM KIẾM ---
    const searchCondition: Prisma.partnersWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const whereCondition: Prisma.partnersWhereInput = {
      AND: [
        type ? { type } : {}, // Lọc theo loại (NCC/Khách hàng)
        roleCondition, // Lọc theo quyền
        searchCondition, // Lọc theo từ khóa
      ],
    };

    // Thực hiện truy vấn (Transaction để lấy cả data và count)
    const [partners, total] = await this.prisma.$transaction([
      this.prisma.partners.findMany({
        where: whereCondition,
        skip: Number(skip),
        take: Number(limit),
        include: {
          profiles: {
            select: { full_name: true, phone_number: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.partners.count({ where: whereCondition }),
    ]);

    return {
      data: partners,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        last_page: Math.ceil(total / limit),
      },
    };
  }

  // 3. Xem chi tiết
  async findOne(id: number) {
    const partner = await this.prisma.partners.findUnique({
      where: { id: BigInt(id) },
      include: {
        profiles: { select: { full_name: true } },
        orders: {
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
      throw new NotFoundException(`Không tìm thấy đối tác ID: ${id}`);
    return partner;
  }

  // 4. Cập nhật (Thông tin chung)
  async update(id: number, dto: UpdatePartnerDto) {
    await this.findOne(id); // Check exists
    try {
      return await this.prisma.partners.update({
        where: { id: BigInt(id) },
        data: dto,
      });
    } catch (error) {
      this.handlePrismaError(error, dto.code);
    }
  }

  // 5. Phân bổ khách hàng (Chỉ Admin)
  async assignStaff(id: number, staffId: string, user: UserPayload) {
    // Check quyền
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ Admin mới có quyền phân bổ khách hàng.',
      );
    }

    await this.findOne(id); // Check exists

    // Có thể cần check xem staffId có tồn tại trong bảng profiles không
    // Nhưng Prisma sẽ ném lỗi foreign key nếu không tồn tại -> để Prisma lo

    return this.prisma.partners.update({
      where: { id: BigInt(id) },
      data: { assigned_staff_id: staffId },
    });
  }

  // 6. Khóa/Mở khóa khách hàng (Chỉ Admin)
  async updateStatus(
    id: number,
    status: 'active' | 'locked',
    user: UserPayload,
  ) {
    // Check quyền
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ Admin mới có quyền khóa/mở khóa khách hàng.',
      );
    }

    const partner = await this.findOne(id);

    // Nếu trạng thái giống nhau thì không làm gì
    if (partner.status === status) return partner;

    return this.prisma.partners.update({
      where: { id: BigInt(id) },
      data: { status },
    });
  }

  // Helper xử lý lỗi Prisma
  private handlePrismaError(error: any, code?: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Mã khách hàng '${code}' đã tồn tại.`);
      }
      // Bổ sung các mã lỗi khác (ví dụ P2003 Foreign Key...)
    }
    throw error;
  }

  async remove(id: number, user: UserPayload) {
    // 1. Check quyền Admin
    if (user.role !== 'admin') {
      throw new ForbiddenException('Chỉ Admin mới có quyền xóa khách hàng.');
    }

    // 2. Kiểm tra tồn tại
    const partner = await this.findOne(id);

    // 3. Thực hiện Soft Delete (Khóa lại)
    // Nếu muốn xóa "êm", ta chỉ cần update status.
    // Nếu muốn đánh dấu xóa hẳn trong code logic tương lai, nên thêm cột deleted_at vào DB.
    // Ở đây ta dùng logic status = 'locked'.
    return this.prisma.partners.update({
      where: { id: BigInt(id) },
      data: {
        status: 'locked',
        // Có thể thêm logic: đổi tên thêm hậu tố [DELETED] để giải phóng mã code nếu cần
        // code: `${partner.code}_DEL_${Date.now()}`
      },
    });
  }
}
