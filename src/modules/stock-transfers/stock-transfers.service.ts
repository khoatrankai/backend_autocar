import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class StockTransfersService {
  constructor(private prisma: PrismaService) {}

  // =================================================================
  // 1. TẠO PHIẾU CHUYỂN
  // =================================================================
  async create(dto: CreateTransferDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. XỬ LÝ MÃ PHIẾU (AUTO GENERATE)
      let finalCode = dto.code;
      if (!finalCode) {
        // Nếu không có mã, tự sinh theo format: TRF + YYYYMMDD + Random 4 số
        // Ví dụ: TRF202310258821
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // 20231025
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 1000-9999
        finalCode = `TRF${dateStr}${randomSuffix}`;
      }

      // Validate kho
      if (dto.from_warehouse_id === dto.to_warehouse_id) {
        throw new BadRequestException('Kho nhận và kho gửi phải khác nhau');
      }

      // Khai báo kiểu any[] để tránh lỗi TS
      const itemsData: any[] = [];

      for (const item of dto.items) {
        // Lấy thông tin SP & Tồn kho
        const product = await tx.products.findUnique({
          where: { id: BigInt(item.product_id) },
          include: {
            inventory: {
              where: { warehouse_id: BigInt(dto.from_warehouse_id) },
            },
          },
        });

        if (!product) {
          throw new NotFoundException(
            `Sản phẩm ID ${item.product_id} không tồn tại`,
          );
        }

        // Lấy tồn kho hiện tại (Fallback về 0 nếu null/undefined)
        const currentStock = product.inventory[0]?.quantity ?? 0;

        // Check tồn kho
        if (currentStock < item.quantity) {
          throw new BadRequestException(
            `Sản phẩm ${product.sku} không đủ tồn kho (Tồn: ${currentStock}, Chuyển: ${item.quantity})`,
          );
        }

        // Chuẩn bị data tạo items
        itemsData.push({
          product_id: BigInt(item.product_id),
          quantity: item.quantity,
        });

        // TRỪ KHO NGAY LẬP TỨC
        await tx.inventory.update({
          where: {
            product_id_warehouse_id: {
              product_id: BigInt(item.product_id),
              warehouse_id: BigInt(dto.from_warehouse_id),
            },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        // Ghi Log: Xuất chuyển kho
        await tx.inventory_logs.create({
          data: {
            warehouse_id: BigInt(dto.from_warehouse_id),
            product_id: BigInt(item.product_id),
            change_amount: -item.quantity, // Số âm
            balance_after: currentStock - item.quantity,
            type: 'transfer_out',
            reference_code: finalCode, // <--- SỬ DỤNG MÃ ĐÃ XỬ LÝ
            note: `Chuyển đến kho ID ${dto.to_warehouse_id}`,
          },
        });
      }

      // Tạo phiếu Header
      const transfer = await tx.stock_transfers.create({
        data: {
          code: finalCode, // <--- SỬ DỤNG MÃ ĐÃ XỬ LÝ
          from_warehouse_id: BigInt(dto.from_warehouse_id),
          to_warehouse_id: BigInt(dto.to_warehouse_id),
          staff_id: (dto.staff_id as any) || userId,
          status: (dto.status as any) || 'pending',
          note: dto.note,
          transfer_date: new Date(),
          stock_transfer_items: {
            createMany: { data: itemsData },
          },
        },
      });

      return transfer;
    });
  }

  // =================================================================
  // 2. LẤY DANH SÁCH
  // =================================================================
  async findAll(query: any) {
    const {
      from_warehouse,
      to_warehouse,
      status,
      startDate,
      endDate,
      page,
      limit,
    } = query;

    // 1. Xử lý Phân trang
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // 2. Xử lý điều kiện lọc (Giữ nguyên logic cũ)
    const where: any = {};
    if (from_warehouse) where.from_warehouse_id = BigInt(from_warehouse);
    if (to_warehouse) where.to_warehouse_id = BigInt(to_warehouse);
    if (status) where.status = status;
    if (startDate && endDate) {
      where.transfer_date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // 3. Gọi DB song song (Lấy dữ liệu + Đếm tổng)
    const [list, total] = await Promise.all([
      this.prisma.stock_transfers.findMany({
        where,
        include: {
          warehouses_stock_transfers_from_warehouse_idTowarehouses: {
            select: { name: true },
          },
          warehouses_stock_transfers_to_warehouse_idTowarehouses: {
            select: { name: true },
          },
          profiles: { select: { full_name: true } },
        },
        orderBy: { transfer_date: 'desc' },
        skip: skip, // <--- Bỏ qua số lượng bản ghi cũ
        take: limitNum, // <--- Lấy số lượng bản ghi giới hạn
      }),
      this.prisma.stock_transfers.count({ where }), // <--- Đếm tổng số bản ghi thỏa mãn điều kiện
    ]);

    // 4. Xử lý BigInt và trả về kết quả phân trang
    const serializedList = JSON.parse(
      JSON.stringify(list, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );

    return {
      data: serializedList,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findAllAdvanced(query: any) {
    const {
      from_warehouse,
      to_warehouse,
      status,
      startDate,
      endDate,
      page,
      limit,
    } = query;

    // 1. Xử lý Phân trang
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // 2. Xây dựng điều kiện lọc (Where Clause)
    const where: any = {};

    if (from_warehouse) {
      const fromIds = Array.isArray(from_warehouse)
        ? from_warehouse
        : [from_warehouse];
      where.from_warehouse_id = { in: fromIds.map((id) => BigInt(id)) };
    }

    if (to_warehouse) {
      const toIds = Array.isArray(to_warehouse) ? to_warehouse : [to_warehouse];
      where.to_warehouse_id = { in: toIds.map((id) => BigInt(id)) };
    }

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = { in: statuses };
    }

    if (startDate || endDate) {
      where.transfer_date = {};
      if (startDate) where.transfer_date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.transfer_date.lte = end;
      }
    }

    // 3. Thực hiện các truy vấn song song
    const [list, total, allMatchingTransfers] = await Promise.all([
      // A. Lấy danh sách theo trang (Paginated)
      this.prisma.stock_transfers.findMany({
        where,
        include: {
          warehouses_stock_transfers_from_warehouse_idTowarehouses: {
            select: { name: true },
          },
          warehouses_stock_transfers_to_warehouse_idTowarehouses: {
            select: { name: true },
          },
          profiles: { select: { full_name: true } },
          // Cần include items & products để tính giá trị từng dòng
          stock_transfer_items: {
            include: {
              products: { select: { cost_price: true } },
            },
          },
        },
        orderBy: { transfer_date: 'desc' },
        skip: skip,
        take: limitNum,
      }),

      // B. Đếm tổng số bản ghi
      this.prisma.stock_transfers.count({ where }),

      // C. Lấy TẤT CẢ items thoả mãn điều kiện để tính "Tổng giá trị" (Grand Total)
      // Lưu ý: Chỉ select các trường cần thiết để tối ưu hiệu năng
      this.prisma.stock_transfers.findMany({
        where,
        select: {
          stock_transfer_items: {
            select: {
              quantity: true,
              products: {
                select: { cost_price: true },
              },
            },
          },
        },
      }),
    ]);

    // 4. Tính toán Grand Total Value (Số to đùng trên header bảng)
    let grandTotalValue = 0;
    allMatchingTransfers.forEach((transfer) => {
      transfer.stock_transfer_items.forEach((item) => {
        const qty = item.quantity || 0;
        const price = Number(item.products?.cost_price || 0);
        grandTotalValue += qty * price;
      });
    });

    // 5. Map dữ liệu trả về (Tính total_value cho từng dòng + convert BigInt)
    const serializedList = list.map((item) => {
      // Tính giá trị của phiếu này
      const rowTotalValue = item.stock_transfer_items.reduce((sum, i) => {
        const qty = i.quantity || 0;
        const price = Number(i.products?.cost_price || 0);
        return sum + qty * price;
      }, 0);

      // Convert BigInt sang string thủ công để tránh lỗi JSON
      const serializedItem = JSON.parse(
        JSON.stringify(item, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      );

      return {
        ...serializedItem,
        total_value: rowTotalValue, // Thêm trường này cho Frontend hiển thị cột "Giá trị chuyển"
      };
    });

    return {
      data: serializedList,
      total,
      totalValue: grandTotalValue, // Trả về tổng tiền toàn bộ danh sách lọc
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  // =================================================================
  // 3. CHI TIẾT PHIẾU
  // =================================================================
  async findOne(id: number) {
    const transfer = await this.prisma.stock_transfers.findUnique({
      where: { id: BigInt(id) },
      include: {
        stock_transfer_items: {
          include: {
            products: {
              select: {
                sku: true,
                name: true,
                unit: true,
                cost_price: true, // Đây là giá vốn (dùng làm giá chuyển)
              },
            },
          },
        },
        warehouses_stock_transfers_from_warehouse_idTowarehouses: true,
        warehouses_stock_transfers_to_warehouse_idTowarehouses: true,
        profiles: true,
      },
    });

    if (!transfer) throw new NotFoundException('Phiếu chuyển không tồn tại');

    // --- TÍNH TOÁN GIÁ TRỊ MỞ RỘNG ---
    const enrichedTransfer = {
      ...transfer,
      stock_transfer_items: transfer.stock_transfer_items.map((item) => {
        // 1. Lấy giá chuyển (từ giá vốn sản phẩm)
        // Convert Decimal/BigInt sang Number để tính toán
        const price = Number(item.products?.cost_price || 0);

        // 2. Lấy số lượng
        const quantity = item.quantity || 0;

        // 3. Tính Thành tiền
        const total = price * quantity;

        return {
          ...item,
          price: price, // Field mới: Giá chuyển
          total: total, // Field mới: Thành tiền
        };
      }),
    };

    // Serialize BigInt và trả về
    return JSON.parse(
      JSON.stringify(enrichedTransfer, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  // =================================================================
  // 4. NHẬN HÀNG
  // =================================================================
  async receive(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stock_transfers.findUnique({
        where: { id: BigInt(id) },
        include: { stock_transfer_items: true },
      });

      if (!transfer || transfer.status !== 'pending') {
        throw new BadRequestException('Phiếu không hợp lệ hoặc đã được xử lý');
      }

      // Xử lý từng item
      for (const item of transfer.stock_transfer_items) {
        const itemId = item.product_id;
        const transferQty = item.quantity ?? 0;
        const targetWarehouseId = transfer.to_warehouse_id;

        if (!itemId || !targetWarehouseId) continue;

        // A. Lấy tồn kho hiện tại ở KHO NHẬN
        const destInventory = await tx.inventory.findUnique({
          where: {
            product_id_warehouse_id: {
              product_id: itemId,
              warehouse_id: targetWarehouseId,
            },
          },
        });
        const oldStock = destInventory?.quantity ?? 0;

        // B. Cộng tồn kho (Upsert)
        await tx.inventory.upsert({
          where: {
            product_id_warehouse_id: {
              product_id: itemId,
              warehouse_id: targetWarehouseId,
            },
          },
          update: { quantity: { increment: transferQty } },
          create: {
            product_id: itemId,
            warehouse_id: targetWarehouseId,
            quantity: transferQty,
          },
        });

        // C. Ghi Log Nhập
        await tx.inventory_logs.create({
          data: {
            warehouse_id: targetWarehouseId,
            product_id: itemId,
            change_amount: transferQty,
            balance_after: oldStock + transferQty,
            type: 'transfer_in',
            reference_code: transfer.code,
            note: `Nhận từ kho ID ${transfer.from_warehouse_id}`,
          },
        });

        // D. TÍNH LẠI GIÁ VỐN (Weighted Average)
        // (Logic giữ nguyên, bỏ qua update nếu chưa cần thiết)
      }

      // Cập nhật trạng thái phiếu
      const updated = await tx.stock_transfers.update({
        where: { id: BigInt(id) },
        data: { status: 'completed' },
      });

      return JSON.parse(
        JSON.stringify(updated, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      );
    });
  }

  // =================================================================
  // 5. TỪ CHỐI / HỦY PHIẾU
  // =================================================================
  async reject(id: number, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stock_transfers.findUnique({
        where: { id: BigInt(id) },
        include: { stock_transfer_items: true },
      });

      if (!transfer) throw new NotFoundException('Phiếu không tồn tại');
      if (transfer.status !== 'pending') {
        throw new BadRequestException('Chỉ có thể từ chối phiếu đang chuyển');
      }

      for (const item of transfer.stock_transfer_items) {
        const itemId = item.product_id;
        const rejectQty = item.quantity ?? 0;
        const sourceWarehouseId = transfer.from_warehouse_id;

        if (!itemId || !sourceWarehouseId) continue;

        // Lấy tồn kho hiện tại để ghi log đúng
        const sourceInv = await tx.inventory.findUnique({
          where: {
            product_id_warehouse_id: {
              product_id: itemId,
              warehouse_id: sourceWarehouseId,
            },
          },
        });
        const currentSourceStock = sourceInv?.quantity ?? 0;

        // Hoàn lại kho gửi
        await tx.inventory.update({
          where: {
            product_id_warehouse_id: {
              product_id: itemId,
              warehouse_id: sourceWarehouseId,
            },
          },
          data: { quantity: { increment: rejectQty } },
        });

        // Ghi Log hoàn trả
        await tx.inventory_logs.create({
          data: {
            warehouse_id: sourceWarehouseId,
            product_id: itemId,
            change_amount: rejectQty, // Số dương
            balance_after: currentSourceStock + rejectQty,
            type: 'transfer_return',
            reference_code: transfer.code,
            note: `Kho nhận từ chối: ${reason}`,
          },
        });
      }

      // Đổi trạng thái -> cancelled
      const updated = await tx.stock_transfers.update({
        where: { id: BigInt(id) },
        data: {
          status: 'cancelled',
          note: `${transfer.note ? transfer.note + ' | ' : ''}Lý do từ chối: ${reason}`,
        },
      });

      return JSON.parse(
        JSON.stringify(updated, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      );
    });
  }
}
