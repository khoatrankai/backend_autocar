import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    // Sử dụng Prisma Transaction để đảm bảo tính toàn vẹn dữ liệu
    return this.prisma.$transaction(async (tx) => {
      // 1. Tính tổng tiền
      const totalAmount = dto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // 2. Tạo Order Header
      const order = await tx.orders.create({
        data: {
          code: dto.code,
          partner_id: BigInt(dto.partner_id),
          staff_id: dto.staff_id,
          total_amount: totalAmount,
          final_amount: totalAmount, // Giả sử chưa discount
          status: 'completed', // Model orders dùng String cho status (từ schema của bạn)
        },
      });

      // 3. Tạo Order Items
      for (const item of dto.items) {
        // Lấy thông tin sản phẩm để snapshot tên/sku (Optional)
        const product = await tx.products.findUnique({
          where: { id: BigInt(item.product_id) },
        });
        if (!product)
          throw new BadRequestException(`Product ${item.product_id} not found`);

        await tx.order_items.create({
          data: {
            order_id: order.id,
            product_id: BigInt(item.product_id),
            product_name: product.name,
            product_sku: product.sku,
            quantity: item.quantity,
            price: item.price,
          },
        });

        // 4. Trigger Update Inventory (Nếu DB bạn chưa có trigger SQL tự động)
        // await this.updateInventory(tx, item.product_id, item.quantity);
      }

      return order;
    });
  }

  async findAll() {
    return this.prisma.orders.findMany({
      include: {
        order_items: true,
        partners: true,
        profiles: { select: { full_name: true } }, // Chỉ lấy tên nhân viên
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
