import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateReturnDto } from './dto/create-return.dto';
import { PrismaService } from 'src/shared/prisma/prisma.service';

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
          order_id: BigInt(dto.order_id),
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
      await tx.orders.update({
        where: { id: BigInt(dto.order_id) },
        data: { status: 'returned' },
      });

      return returnOrder;
    });
  }
}
