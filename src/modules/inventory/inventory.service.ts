import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { CheckInventoryDto } from './dto/check-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async checkStock(query: CheckInventoryDto) {
    const { product_id, warehouse_id } = query;

    // 1. Lấy thông tin tồn kho của sản phẩm ở TẤT CẢ các kho
    // Lý do: Để đáp ứng mục đích "Kho này hết, kho kia còn" giúp Sale tư vấn.
    const inventoryRecords = await this.prisma.inventory.findMany({
      where: {
        product_id: BigInt(product_id),
      },
      include: {
        warehouses: {
          select: { id: true, name: true },
        },
      },
      orderBy: { quantity: 'desc' }, // Ưu tiên hiển thị kho còn nhiều hàng lên trước
    });

    // Nếu không tìm thấy sản phẩm trong kho nào
    if (!inventoryRecords.length) {
      // Có thể check thêm bảng products để xem product_id có tồn tại không nếu cần chặt chẽ
      return {
        product_id: Number(product_id),
        total_stock: 0,
        details: [],
      };
    }

    // 2. Tính tổng tồn kho (Global Stock)
    const totalStock = inventoryRecords.reduce(
      (sum, record) => sum + (record.quantity || 0),
      0,
    );

    // 3. Map dữ liệu sang format chi tiết
    const details = inventoryRecords.map((record) => ({
      warehouse_id: Number(record.warehouse_id),
      name: record.warehouses?.name || 'Unknown Warehouse',
      quantity: record.quantity,
    }));

    // (Optional) Nếu có warehouse_id trong query, có thể sort đưa kho đó lên đầu danh sách
    if (warehouse_id) {
      details.sort((a, b) => {
        return a.warehouse_id === warehouse_id ? -1 : 1;
      });
    }

    // 4. Trả về kết quả
    return {
      product_id: Number(product_id),
      total_stock: totalStock,
      details: details,
    };
  }
}
