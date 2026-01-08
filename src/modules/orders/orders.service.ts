import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto, userId: string) {
    // userId lấy từ token để ghi log/staff_id
    // Sử dụng Prisma Transaction để đảm bảo tính toàn vẹn dữ liệu (All or Nothing)
    return this.prisma.$transaction(async (tx) => {
      // ---------------------------------------------------------
      // 1. TÍNH TOÁN TỔNG TIỀN
      // ---------------------------------------------------------
      const totalAmount = dto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // ---------------------------------------------------------
      // 2. CHECK KHÁCH HÀNG & CÔNG NỢ (Business Logic)
      // ---------------------------------------------------------
      const partner = await tx.partners.findUnique({
        where: { id: BigInt(dto.partner_id) },
      });

      if (!partner) {
        throw new NotFoundException('Khách hàng không tồn tại');
      }

      // Logic 1: Check trạng thái khóa
      if (partner.status === 'locked') {
        throw new ForbiddenException('Khách hàng đang bị khóa giao dịch');
      }

      // Logic 2: Check hạn mức nợ
      // Lưu ý: Prisma trả về Decimal hoặc Number tùy config, ta ép về Number để so sánh
      const currentDebt = Number(partner.current_debt || 0);
      const debtLimit = Number(partner.debt_limit || 0);
      const newDebt = currentDebt + totalAmount;

      if (newDebt > debtLimit) {
        throw new BadRequestException(
          `Vượt hạn mức công nợ cho phép. Nợ hiện tại: ${currentDebt}, Đơn này: ${totalAmount}, Hạn mức: ${debtLimit}`,
        );
      }

      // ---------------------------------------------------------
      // 3. CHECK & TRỪ TỒN KHO (Inventory Logic)
      // ---------------------------------------------------------
      // Duyệt qua từng sản phẩm để kiểm tra tồn kho tại warehouse_id cụ thể
      for (const item of dto.items) {
        // Tìm bản ghi tồn kho của sản phẩm tại kho cụ thể
        const inventory = await tx.inventory.findUnique({
          where: {
            product_id_warehouse_id: {
              product_id: BigInt(item.product_id),
              warehouse_id: BigInt(dto.warehouse_id),
            },
          },
        });

        // Logic 3: Check số lượng tồn
        if (!inventory || (inventory.quantity || 0) < item.quantity) {
          // Lấy tên sản phẩm để báo lỗi cho rõ ràng
          const productInfo = await tx.products.findUnique({
            where: { id: BigInt(item.product_id) },
            select: { name: true },
          });

          throw new BadRequestException(
            `Sản phẩm "${productInfo?.name || item.product_id}" tại kho này không đủ hàng. (Tồn: ${inventory?.quantity || 0}, Yêu cầu: ${item.quantity})`,
          );
        }

        // Action 1: Trừ tồn kho ngay lập tức
        await tx.inventory.update({
          where: {
            product_id_warehouse_id: {
              product_id: BigInt(item.product_id),
              warehouse_id: BigInt(dto.warehouse_id),
            },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        });
      }

      // ---------------------------------------------------------
      // 4. TẠO ĐƠN HÀNG (Create Order)
      // ---------------------------------------------------------
      // Tự sinh mã đơn hàng nếu không truyền (VD: ORD + Timestamp)
      const orderCode = dto.code || `ORD${Date.now()}`;

      const order = await tx.orders.create({
        data: {
          code: orderCode,
          partner_id: BigInt(dto.partner_id),
          warehouse_id: BigInt(dto.warehouse_id), // Quan trọng: Ghi nhận đơn hàng xuất từ kho nào
          staff_id: dto.staff_id || userId, // Nhân viên tạo đơn (hoặc lấy từ token)
          total_amount: totalAmount,
          final_amount: totalAmount, // Chưa tính discount
          paid_amount: 0, // Mới tạo chưa thanh toán
          status: 'completed', // Mặc định completed theo schema của bạn
          note: dto.note,
        },
      });

      // ---------------------------------------------------------
      // 5. TẠO ORDER ITEMS
      // ---------------------------------------------------------
      for (const item of dto.items) {
        // Lấy thông tin sản phẩm để snapshot (Lưu cứng tên/sku vào thời điểm mua)
        const product = await tx.products.findUnique({
          where: { id: BigInt(item.product_id) },
        });

        await tx.order_items.create({
          data: {
            order_id: order.id,
            product_id: BigInt(item.product_id),
            product_name: product?.name, // Snapshot name
            product_sku: product?.sku, // Snapshot SKU
            quantity: item.quantity,
            price: item.price,
            discount: 0,
          },
        });
      }

      // ---------------------------------------------------------
      // 6. CẬP NHẬT CÔNG NỢ KHÁCH HÀNG
      // ---------------------------------------------------------
      await tx.partners.update({
        where: { id: BigInt(dto.partner_id) },
        data: {
          current_debt: { increment: totalAmount }, // Cộng dồn nợ
          total_revenue: { increment: totalAmount }, // Cộng doanh số
        },
      });

      // ---------------------------------------------------------
      // 7. GHI LOG HOẠT ĐỘNG (Activity Logs)
      // ---------------------------------------------------------
      await tx.activity_logs.create({
        data: {
          user_id: userId, // ID người thực hiện
          action: 'CREATE_ORDER',
          entity: 'orders',
          entity_id: order.id.toString(),
          details: {
            code: orderCode,
            amount: totalAmount,
            partner_id: dto.partner_id,
          },
        },
      });

      return order;
    });
  }

  async findAll() {
    return this.prisma.orders.findMany({
      include: {
        order_items: true,
        partners: { select: { name: true, phone: true } },
        warehouses: { select: { name: true } }, // Join thêm tên kho
        profiles: { select: { full_name: true } }, // Tên nhân viên
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
