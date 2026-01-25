import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReturnDto } from './dto/create-return.dto';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { FilterReturnDto } from './dto/filter-return.dto';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReturnDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Tính tổng tiền hoàn
      const totalRefund = dto.items.reduce(
        (sum, item) => sum + item.refund_price * item.quantity,
        0,
      );

      // 2. Tạo Header
      const returnOrder = await tx.returns.create({
        data: {
          code: dto.code,
          order_id: dto.order_id ? BigInt(dto.order_id) : undefined,
          partner_id: BigInt(dto.partner_id),
          total_refund: totalRefund,
          reason: dto.reason,
          status: 'completed',
        },
      });

      // 3. Tạo Items
      for (const item of dto.items) {
        // Lấy thông tin SP để lưu snapshot tên/sku
        const product = await tx.products.findUnique({
          where: { id: BigInt(item.product_id) },
        });
        if (!product)
          throw new BadRequestException(`Product ${item.product_id} not found`);

        await tx.return_items.create({
          data: {
            return_id: returnOrder.id,
            product_id: BigInt(item.product_id),
            product_sku: product.sku,
            product_name: product.name,
            quantity: item.quantity,
            refund_price: item.refund_price,
          },
        });

        // Lưu ý: Trigger handle_return_inventory trong SQL sẽ tự động chạy để cộng kho
        // Nếu trigger SQL chưa chuẩn, bạn cần cộng kho thủ công ở đây:
        // await tx.inventory.update(...)
      }

      // 4. (Optional) Cập nhật trạng thái đơn hàng gốc thành 'returned'
      dto.order_id &&
        (await tx.orders.update({
          where: { id: BigInt(dto.order_id) },
          data: { status: 'returned' },
        }));

      return returnOrder;
    });
  }

  async findAll(query: FilterReturnDto) {
    const {
      page,
      limit,
      search,
      branchIds,
      status,
      startDate,
      endDate,
      creatorIds,
      partnerIds,
    } = query;

    // 1. Phân trang
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // 2. Xây dựng điều kiện Where
    const where: any = {};

    // --- Filter Search (Mã phiếu hoặc Tên đối tác) ---
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { partners: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // --- Filter Chi nhánh (Dựa vào Order liên quan) ---
    if (branchIds) {
      const branches = Array.isArray(branchIds) ? branchIds : [branchIds];
      where.orders = {
        warehouse_id: { in: branches.map((id) => BigInt(id)) },
      };
    }

    // --- Filter Trạng thái ---
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = { in: statuses };
    }

    // --- Filter Thời gian (Ngày tạo) ---
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Lấy hết ngày cuối
        where.created_at.lte = end;
      }
    }

    // --- Filter Người tạo (Dựa vào Staff của Order) ---
    // *Lưu ý: Schema returns hiện tại không có staff_id trực tiếp, nên lấy qua orders
    if (creatorIds) {
      const creators = Array.isArray(creatorIds) ? creatorIds : [creatorIds];
      where.orders = {
        ...where.orders, // Giữ lại điều kiện warehouse nếu có
        staff_id: { in: creators }, // staff_id là UUID (String)
      };
    }

    // --- Filter Người trả (Partner/Nhà cung cấp) ---
    if (partnerIds) {
      const partners = Array.isArray(partnerIds) ? partnerIds : [partnerIds];
      where.partner_id = { in: partners.map((id) => BigInt(id)) };
    }

    // 3. Thực hiện Query song song
    const [list, total, aggregation] = await Promise.all([
      // A. Lấy danh sách phân trang
      this.prisma.returns.findMany({
        where,
        include: {
          partners: { select: { id: true, name: true, code: true } }, // Thông tin người trả
          orders: {
            include: {
              warehouses: { select: { name: true } }, // Tên kho (Chi nhánh)
              profiles: { select: { full_name: true } }, // Tên người tạo (Staff)
            },
          },
          // Include items để hiển thị chi tiết nếu cần
          return_items: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),

      // B. Đếm tổng số bản ghi
      this.prisma.returns.count({ where }),

      // C. Tính tổng tiền trả lại (Hiển thị trên header bảng nếu cần)
      this.prisma.returns.aggregate({
        where,
        _sum: {
          total_refund: true,
        },
      }),
    ]);

    // 4. Serialize BigInt sang String (Tránh lỗi JSON)
    const serializedList = JSON.parse(
      JSON.stringify(list, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );

    const totalRefundAmount = Number(aggregation._sum.total_refund || 0);

    return {
      data: serializedList,
      total,
      totalRefund: totalRefundAmount, // Tổng tiền hoàn trả của bộ lọc hiện tại
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findOne(id: string) {
    const returnOrder = await this.prisma.returns.findUnique({
      where: { id: BigInt(id) },
      include: {
        // Lấy thông tin đối tác (NCC/Khách hàng)
        partners: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            code: true,
          },
        },
        // Lấy thông tin đơn hàng gốc (nếu có)
        orders: {
          select: {
            code: true,
            created_at: true,
            warehouses: { select: { name: true } }, // Kho
            profiles: { select: { full_name: true } }, // Nhân viên bán
          },
        },
        // Lấy danh sách sản phẩm trả
        return_items: {
          include: {
            products: {
              select: {
                sku: true,
                name: true,
                unit: true,
                image_url: true,
              },
            },
          },
        },
      },
    });

    if (!returnOrder) {
      throw new NotFoundException(`Không tìm thấy phiếu trả hàng có ID: ${id}`);
    }

    // Serialize BigInt và tính toán thêm nếu cần
    return JSON.parse(
      JSON.stringify(returnOrder, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  // 2. UPDATE: Cập nhật phiếu trả (Thường chỉ cho sửa khi chưa Hoàn thành)
  async update(id: string, data: any) {
    // Kiểm tra tồn tại
    const exists = await this.prisma.returns.findUnique({
      where: { id: BigInt(id) },
    });
    if (!exists) throw new NotFoundException('Phiếu trả không tồn tại');

    // Chỉ cho phép sửa nếu trạng thái là 'pending' (hoặc logic tùy bạn)
    if (exists.status === 'completed' || exists.status === 'cancelled') {
      // throw new BadRequestException('Không thể sửa phiếu đã hoàn thành hoặc đã hủy');
      // Tạm thời comment để bạn test, tùy nghiệp vụ
    }

    // Tách các trường update (ví dụ chỉ update ghi chú, hoặc status)
    const { reason, status } = data;

    const updated = await this.prisma.returns.update({
      where: { id: BigInt(id) },
      data: {
        reason,
        status,
        // Nếu muốn update items thì logic phức tạp hơn (xóa cũ thêm mới),
        // ở đây tạm thời update thông tin cơ bản
      },
    });

    return JSON.parse(
      JSON.stringify(updated, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  // 3. DELETE: Xóa 1 phiếu (Thường là xóa mềm hoặc xóa hẳn nếu là phiếu nháp)
  async remove(id: string) {
    // Kiểm tra tồn tại
    const exists = await this.prisma.returns.findUnique({
      where: { id: BigInt(id) },
    });
    if (!exists) throw new NotFoundException('Phiếu trả không tồn tại');

    // Nếu phiếu đã hoàn thành, thường không cho xóa để bảo toàn lịch sử kho/tiền
    if (exists.status === 'completed') {
      throw new BadRequestException(
        'Không thể xóa phiếu đã hoàn thành. Hãy hủy phiếu thay vì xóa.',
      );
    }

    // Xóa (Prisma sẽ tự xóa return_items nếu cấu hình onDelete: Cascade trong schema)
    // Nếu schema chưa có Cascade, bạn phải xóa items trước:
    // await this.prisma.return_items.deleteMany({ where: { return_id: BigInt(id) } });

    const deleted = await this.prisma.returns.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Đã xóa thành công', id };
  }

  // 4. DELETE MANY: Xóa nhiều phiếu
  async removeMany(ids: string[]) {
    if (!ids || ids.length === 0) return { count: 0 };

    // Chuyển mảng string ID sang BigInt
    const bigIntIds = ids.map((id) => BigInt(id));

    // Kiểm tra điều kiện (ví dụ không xóa phiếu completed) - Tùy chọn
    const validToDelete = await this.prisma.returns.count({
      where: {
        id: { in: bigIntIds },
        status: { not: 'completed' }, // Chỉ đếm các phiếu chưa hoàn thành
      },
    });

    if (validToDelete !== ids.length) {
      // throw new BadRequestException('Một số phiếu đã hoàn thành không thể xóa');
      // Hoặc cứ xóa những cái nào xóa được:
    }

    // Thực hiện xóa
    const result = await this.prisma.returns.deleteMany({
      where: {
        id: { in: bigIntIds },
        status: { not: 'completed' }, // An toàn: Chỉ xóa phiếu chưa hoàn thành
      },
    });

    return {
      message: `Đã xóa ${result.count} phiếu trả hàng`,
      count: result.count,
    };
  }
}
