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
import * as ExcelJS from 'exceljs';
import { FilterSupplierDto } from './dto/filter-supplier.dto';

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
  private sanitizePartner(partner: any, role: string) {
    const p = {
      ...partner,
      id: partner.id.toString(), // Convert BigInt safe JSON
    };

    // Chỉ Admin và Kế toán được xem tiền nong
    const allowedRoles = ['admin', 'accountant'];

    if (!allowedRoles.includes(role)) {
      // Ẩn các cột tài chính đối với Sale/Warehouse
      delete p.total_revenue;
      delete p.current_debt;
      delete p.debt_limit;
    }
    return p;
  }
  // 2. Lấy danh sách (Phân trang + Phân quyền)
  async findAll(filter: FilterPartnerDto, user: UserPayload) {
    const {
      search,
      type,
      page = 1,
      limit = 10,
      fromDate,
      toDate,
      minRevenue,
      maxRevenue,
      minDebt,
      maxDebt,
    } = filter;

    const skip = (page - 1) * limit;

    // 1. Phân quyền dữ liệu (Ai được xem khách hàng nào)
    let roleCondition: Prisma.partnersWhereInput = {};
    if (user.role === 'sale') {
      roleCondition = {
        OR: [{ assigned_staff_id: user.id }, { assigned_staff_id: null }],
      };
    }

    // 2. Lọc theo thời gian (Created At)
    const dateCondition: Prisma.partnersWhereInput =
      fromDate || toDate
        ? {
            created_at: {
              gte: fromDate ? new Date(fromDate) : undefined,
              lte: toDate ? new Date(toDate) : undefined,
            },
          }
        : {};

    // 3. Lọc theo doanh số & công nợ
    const revenueCondition: Prisma.partnersWhereInput =
      minRevenue || maxRevenue
        ? {
            total_revenue: {
              gte: minRevenue || undefined,
              lte: maxRevenue || undefined,
            },
          }
        : {};

    const debtCondition: Prisma.partnersWhereInput =
      minDebt || maxDebt
        ? {
            current_debt: {
              gte: minDebt || undefined,
              lte: maxDebt || undefined,
            },
          }
        : {};

    // 4. Tìm kiếm từ khóa (Bỏ search tax_code)
    const searchCondition: Prisma.partnersWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const whereCondition: Prisma.partnersWhereInput = {
      AND: [
        type ? { type } : {},
        roleCondition,
        searchCondition,
        dateCondition,
        revenueCondition,
        debtCondition,
      ],
    };

    // 5. Query Database
    const [partners, total] = await this.prisma.$transaction([
      this.prisma.partners.findMany({
        where: whereCondition,
        skip: Number(skip),
        take: Number(limit),
        include: {
          profiles: { select: { full_name: true, phone_number: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.partners.count({ where: whereCondition }),
    ]);

    // 6. SANITIZE DATA (Xử lý ẩn hiện cột nhạy cảm theo Role)
    // "Các mục này chỉ có account Ban lãnh đạo mới xem"
    const safePartners = partners.map((p) =>
      this.sanitizePartner(p, user.role),
    );

    return {
      data: safePartners,
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

  async importExcel(file: Express.Multer.File, user: UserPayload) {
    // 1. Khởi tạo Workbook và đọc Buffer
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    // 2. Lấy Sheet đầu tiên
    const worksheet = workbook.getWorksheet(1); // ExcelJS index bắt đầu từ 1
    if (!worksheet) {
      throw new Error('File Excel không có dữ liệu (Sheet 1 rỗng)');
    }

    let successCount = 0;
    const errors: string[] = [];

    // 3. Duyệt từng dòng (Bỏ qua dòng 1 là Header)
    // Cấu trúc file Excel mong đợi:
    // Cột 1: Mã | Cột 2: Tên | Cột 3: SĐT | Cột 4: Email | Cột 5: Địa chỉ

    // Sử dụng Promise.all để xử lý async trong vòng lặp (hoặc dùng for...of)
    // Tuy nhiên eachRow là sync callback, nên ta sẽ gom data trước rồi save
    const rowsToInsert: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Bỏ qua header

      // Lấy dữ liệu theo thứ tự cột (Index bắt đầu từ 1)
      // row.getCell(1).text sẽ an toàn hơn .value (đề phòng rich text/formula)
      const code = row.getCell(1).text;
      const name = row.getCell(2).text;
      const phone = row.getCell(3).text;
      const email = row.getCell(4).text;
      const address = row.getCell(5).text;

      if (!name || !phone) {
        errors.push(`Dòng ${rowNumber}: Thiếu Tên hoặc SĐT`);
        return;
      }

      rowsToInsert.push({
        index: rowNumber,
        data: {
          code: code || `KH_IMP_${Date.now()}_${rowNumber}`,
          name: name,
          phone: phone,
          email: email,
          address: address,
          type: 'supplier',
          assigned_staff_id: user.id,
          status: 'active',
          current_debt: 0,
          total_revenue: 0,
        },
      });
    });

    // 4. Thực hiện Insert vào DB
    for (const item of rowsToInsert) {
      try {
        await this.prisma.partners.create({
          data: item.data,
        });
        successCount++;
      } catch (err) {
        errors.push(`Dòng ${item.index}: Lỗi lưu DB (${err.message})`);
      }
    }

    return {
      success: true,
      message: `Đã import ${successCount} dòng. Lỗi ${errors.length}.`,
      errors: errors.length ? errors : null,
    };
  }

  // =================================================================
  // YÊU CẦU 2: EXPORT EXCEL (DÙNG EXCELJS)
  // =================================================================
  async exportExcel(filter: FilterPartnerDto, user: UserPayload) {
    // 1. Lấy dữ liệu (Đã qua bộ lọc)
    // Lưu ý: data trả về đã được chạy qua hàm sanitizePartner ở trong findAll
    const { data } = await this.findAll(
      { ...filter, page: 1, limit: 100000 },
      user,
    );

    // 2. Tạo Workbook & Worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách đối tác');

    // 3. Định nghĩa Cột (Columns)
    // key: phải khớp với key trong object data bạn map phía dưới
    const columns = [
      { header: 'Mã ĐT', key: 'code', width: 15 },
      { header: 'Tên đối tác', key: 'name', width: 30 },
      { header: 'Số điện thoại', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Địa chỉ', key: 'address', width: 40 },
      { header: 'Nhóm', key: 'group_name', width: 15 },
      { header: 'NV Phụ trách', key: 'staff_name', width: 20 },
      { header: 'Ngày tạo', key: 'created_at', width: 15 },
    ];

    // Chỉ thêm cột tài chính nếu User có quyền (Admin/Kế toán)
    // Check bằng cách xem data dòng đầu tiên có trường đó không
    const hasFinancialData = data.length > 0 && 'total_revenue' in data[0];

    if (hasFinancialData) {
      columns.push(
        { header: 'Tổng mua', key: 'total_revenue', width: 20 },
        { header: 'Nợ hiện tại', key: 'current_debt', width: 20 },
      );
    }

    worksheet.columns = columns;

    // 4. Map dữ liệu & Thêm dòng
    const exportData = data.map((p: any) => ({
      code: p.code,
      name: p.name,
      phone: p.phone,
      email: p.email,
      address: p.address,
      group_name: p.group_name,
      staff_name: p.profiles?.full_name || '',
      created_at: p.created_at
        ? new Date(p.created_at).toLocaleDateString()
        : '',
      // Các trường này có thể undefined nếu bị sanitize
      total_revenue: p.total_revenue ? Number(p.total_revenue) : undefined,
      current_debt: p.current_debt ? Number(p.current_debt) : undefined,
    }));

    worksheet.addRows(exportData);

    // 5. Format Header (Tùy chọn: Làm đậm hàng đầu)
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // 6. Trả về Buffer
    // writeBuffer trả về Promise<Buffer>, controller sẽ stream cái này về client
    return await workbook.xlsx.writeBuffer();
  }

  async getPartnerGroups() {
    // Lấy các group_name duy nhất, chỉ của 'supplier' (hoặc 'partner')
    const groups = await this.prisma.partners.findMany({
      where: {
        // Lưu ý: Kiểm tra DB xem bạn lưu là 'supplier' hay 'partner'
        // type: { in: ['supplier', 'partner'] },
        type: 'supplier', // Giả sử DB lưu là supplier
        group_name: { not: null }, // Bỏ qua null
      },
      distinct: ['group_name'], // Chỉ lấy duy nhất
      select: {
        group_name: true,
      },
      orderBy: {
        group_name: 'asc',
      },
    });

    // Trả về mảng string đơn giản: ['Lốp xe', 'Phụ tùng', ...]
    return groups.map((g) => g.group_name).filter(Boolean);
  }

  async findAllSupplier(query: FilterSupplierDto) {
    const {
      page = 1,
      limit = 10,
      search,
      groupNames,
      minDebt,
      maxDebt,
      minRevenue,
      maxRevenue,
      dateFrom,
      dateTo,
      status,
    } = query;

    const skip = (page - 1) * limit;

    // --- KHỞI TẠO ĐIỀU KIỆN WHERE ---
    const where: Prisma.partnersWhereInput = {
      type: 'supplier', // Cố định chỉ lấy Nhà cung cấp
      AND: [],
    };
    const andCond = where.AND as Prisma.partnersWhereInput[];

    // 1. Tìm kiếm (Tên, Mã, SĐT)
    if (search) {
      andCond.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // 2. Lọc theo Nhóm (group_name)
    if (groupNames && groupNames.length > 0) {
      andCond.push({
        group_name: { in: groupNames, mode: 'insensitive' },
      });
    }

    // 3. Lọc Nợ hiện tại (current_debt)
    if (minDebt !== undefined || maxDebt !== undefined) {
      const debtFilter: Prisma.DecimalFilter = {};
      if (minDebt !== undefined) debtFilter.gte = minDebt;
      if (maxDebt !== undefined) debtFilter.lte = maxDebt;
      andCond.push({ current_debt: debtFilter });
    }

    // 4. Lọc Tổng mua (total_revenue)
    if (minRevenue !== undefined || maxRevenue !== undefined) {
      const revenueFilter: Prisma.DecimalFilter = {};
      if (minRevenue !== undefined) revenueFilter.gte = minRevenue;
      if (maxRevenue !== undefined) revenueFilter.lte = maxRevenue;
      andCond.push({ total_revenue: revenueFilter });
    }

    // 5. Lọc Thời gian tạo (created_at)
    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      andCond.push({ created_at: dateFilter });
    }

    // 6. Trạng thái
    if (status && status !== 'all') {
      andCond.push({ status });
    }

    // --- THỰC THI QUERY ---
    const [data, total] = await Promise.all([
      this.prisma.partners.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.partners.count({ where }),
    ]);

    // --- TRẢ VỀ KẾT QUẢ ---
    return {
      data: data.map((item) => ({
        ...item,
        // Convert Decimal sang Number để Frontend dễ dùng
        id: item.id.toString(),
        current_debt: Number(item.current_debt),
        total_revenue: Number(item.total_revenue),
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
