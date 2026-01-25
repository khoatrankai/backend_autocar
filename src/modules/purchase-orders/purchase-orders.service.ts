import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { FilterPurchaseOrderDto } from './dto/filter-purchase-order.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ====================================================================
  // TẠO PHIẾU NHẬP HÀNG (PO)
  // ====================================================================
  async create(data: CreatePurchaseOrderDto, staffId: string) {
    const {
      items,
      supplier_id,
      warehouse_id,
      status,
      staff_id,
      discount = 0,
      paid_amount = 0,
      note,
      code,
    } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Phiếu nhập phải có ít nhất 1 sản phẩm');
    }

    // 1. Tính toán tổng tiền
    let total_amount = 0;
    items.forEach((item) => {
      total_amount += item.quantity * item.import_price;
    });

    const final_amount = total_amount - discount;

    // 2. Tạo Mã phiếu nếu chưa có (PN + Timestamp)
    const orderCode = code || `PN${Date.now()}`;

    // 3. Insert vào Database
    // Lưu ý: Tên trường quan hệ phải khớp với schema.prisma (purchase_order_items)
    const result = await this.prisma.purchase_orders.create({
      data: {
        code: orderCode,
        supplier_id: supplier_id,
        warehouse_id: warehouse_id,
        staff_id: staff_id || staffId,
        total_amount: total_amount,
        discount: discount,
        final_amount: final_amount,
        paid_amount: paid_amount,
        note: note,
        status: status || 'completed', // 'completed' để trigger chạy cập nhật kho/công nợ

        // SỬA: Dùng 'purchase_order_items' thay vì 'items'
        purchase_order_items: {
          create: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            import_price: item.import_price,
          })),
        },
      },
      include: {
        // SỬA: Include theo tên quan hệ trong schema
        purchase_order_items: true,
      },
    });

    return result;
  }

  // ====================================================================
  // LẤY DANH SÁCH PHIẾU NHẬP
  // ====================================================================
  async findAll(query: any) {
    const { page = 1, limit = 10, search, from, to } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.code = { contains: search, mode: 'insensitive' };
    }

    if (from || to) {
      where.import_date = {};
      if (from) where.import_date.gte = new Date(from);
      if (to) where.import_date.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.purchase_orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { import_date: 'desc' },
        include: {
          // SỬA: Trong schema tên quan hệ là 'partners' chứ không phải 'supplier'
          partners: { select: { name: true } },
          // SỬA: Trong schema tên quan hệ là 'profiles' chứ không phải 'staff'
          profiles: { select: { full_name: true } },
        },
      }),
      this.prisma.purchase_orders.count({ where }),
    ]);

    return {
      data: data.map((item) => ({
        ...item,
        id: item.id.toString(),
        supplier_id: (item?.supplier_id || '').toString(),
        total_amount: Number(item.total_amount),
        final_amount: Number(item.final_amount),
        paid_amount: Number(item.paid_amount),
        // Map lại tên cho FE dễ dùng
        supplier_name: item.partners?.name,
        staff_name: item.profiles?.full_name,
      })),
      meta: { total, page, limit },
    };
  }

  async findAllAdvance(query: FilterPurchaseOrderDto) {
    const {
      page = 1,
      limit = 10,
      search,
      warehouseIds, // List ID chi nhánh
      statuses, // List trạng thái
      dateFrom, // Từ ngày
      dateTo, // Đến ngày
      staffIds, // List ID nhân viên (Người tạo/nhập)
    } = query;

    const skip = (page - 1) * limit;

    // 1. Xây dựng điều kiện Where động
    const where: Prisma.purchase_ordersWhereInput = {
      AND: [],
    };
    const andCond = where.AND as Prisma.purchase_ordersWhereInput[];

    // --- Tìm kiếm chung (Mã phiếu OR Tên nhà cung cấp) ---
    if (search) {
      andCond.push({
        OR: [{ code: { contains: search, mode: 'insensitive' } }],
      });
    }

    // --- Lọc theo Chi nhánh (Kho) ---
    if (warehouseIds && warehouseIds.length > 0) {
      andCond.push({
        warehouse_id: { in: warehouseIds.map((id) => BigInt(id)) },
      });
    }

    // --- Lọc theo Trạng thái ---
    // Frontend gửi lên: ['draft', 'completed', 'cancelled']
    if (statuses && statuses.length > 0) {
      andCond.push({
        status: { in: statuses },
      });
    }

    // --- Lọc theo Thời gian (import_date) ---
    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      // Nếu lọc đến ngày, thường cộng thêm 1 ngày hoặc set cuối ngày để lấy đủ
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.lte = to;
      }
      andCond.push({ import_date: dateFilter });
    }

    // --- Lọc theo Người tạo/Người nhập (Staff) ---
    if (staffIds && staffIds.length > 0) {
      andCond.push({
        staff_id: { in: staffIds },
      });
    }

    // 2. Thực thi Query
    const [data, total] = await Promise.all([
      this.prisma.purchase_orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { import_date: 'desc' }, // Mới nhất lên đầu
        include: {
          partners: { select: { id: true, name: true, code: true } }, // Nhà cung cấp
          warehouses: { select: { id: true, name: true } }, // Kho
          profiles: { select: { id: true, full_name: true } }, // Nhân viên
        },
      }),
      this.prisma.purchase_orders.count({ where }),
    ]);

    // 3. Format dữ liệu trả về
    return {
      data: data.map((item) => ({
        id: item.id.toString(),
        code: item.code,
        import_date: item.import_date,
        status: item.status, // 'draft' | 'completed' | 'cancelled'
        note: item.note,

        // Tiền
        total_amount: Number(item.total_amount),
        discount: Number(item.discount),
        final_amount: Number(item.final_amount), // Cần trả NCC
        paid_amount: Number(item.paid_amount),
        debt_amount: Number(item.final_amount) - Number(item.paid_amount), // Tự tính nợ còn lại của phiếu này

        // Relations
        supplier_name: item.partners?.name,
        supplier_code: item.partners?.code,
        warehouse_name: item.warehouses?.name,
        staff_name: item.profiles?.full_name, // Người tạo/nhập
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // ====================================================================
  // XÓA NHIỀU PHIẾU NHẬP
  // ====================================================================
  async deleteMany(ids: number[]) {
    // 1. Convert IDs sang BigInt
    const bigIntIds = ids.map((id) => BigInt(id));

    // 2. (Tùy chọn) Kiểm tra xem có phiếu nào đã "Hoàn thành" không?
    // Nếu phiếu đã nhập kho rồi mà xóa đi sẽ gây lệch tồn kho.
    const completedOrders = await this.prisma.purchase_orders.count({
      where: {
        id: { in: bigIntIds },
        status: 'completed', // Giả sử status hoàn thành là 'completed'
      },
    });

    if (completedOrders > 0) {
      throw new BadRequestException(
        'Không thể xóa phiếu nhập đã hoàn thành. Hãy hủy phiếu hoặc tạo phiếu trả hàng.',
      );
    }

    // 3. Thực hiện xóa
    const result = await this.prisma.purchase_orders.deleteMany({
      where: {
        id: { in: bigIntIds },
      },
    });

    return {
      message: 'Xóa thành công',
      count: result.count,
    };
  }
}
