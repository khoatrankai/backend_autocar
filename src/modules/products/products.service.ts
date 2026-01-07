import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service'; // Check đường dẫn
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // 1. TẠO SẢN PHẨM (TRANSACTION)
  async create(dto: CreateProductDto) {
    // Kiểm tra trùng SKU
    const exist = await this.prisma.products.findUnique({
      where: { sku: dto.sku },
    });
    if (exist) throw new BadRequestException('Mã SKU này đã tồn tại');

    // Dùng Transaction để đảm bảo: Thêm SP, Thêm Xe, Thêm Kho -> Cùng thành công hoặc cùng thất bại
    return this.prisma.$transaction(async (tx) => {
      // A. Tạo sản phẩm chính
      const product = await tx.products.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          brand: dto.brand,
          unit: dto.unit,
          cost_price: dto.cost_price,
          retail_price: dto.retail_price,
          category_id: BigInt(dto.category_id),
        },
      });

      // B. Thêm danh sách xe tương thích (Nếu có)
      if (dto.compatibility && dto.compatibility.length > 0) {
        await tx.product_compatibility.createMany({
          data: dto.compatibility.map((item) => ({
            product_id: product.id,
            car_make: item.car_make,
            car_model: item.car_model,
            year_start: item.year_start,
            year_end: item.year_end,
          })),
        });
      }

      // C. Khởi tạo tồn kho (Nếu có)
      if (dto.inventory && dto.inventory.length > 0) {
        await tx.inventory.createMany({
          data: dto.inventory.map((item) => ({
            product_id: product.id,
            warehouse_id: BigInt(item.warehouse_id),
            quantity: item.quantity,
          })),
        });
      }

      return product;
    });
  }

  // 2. LẤY DANH SÁCH (PAGINATION + SEARCH)
  async findAll(query: FilterProductDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // Điều kiện tìm kiếm (Tên hoặc SKU chứa từ khóa)
    const whereCondition = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Chạy song song 2 câu lệnh: Lấy data và Đếm tổng
    const [data, total] = await Promise.all([
      this.prisma.products.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          categories: { select: { name: true } }, // Lấy tên danh mục
          inventory: true, // Lấy kèm tồn kho hiện tại
        },
      }),
      this.prisma.products.count({ where: whereCondition }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // 3. CHI TIẾT SẢN PHẨM
  async findOne(id: number) {
    const product = await this.prisma.products.findUnique({
      where: { id: BigInt(id) },
      include: {
        categories: true,
        product_compatibility: true, // Lấy danh sách xe
        inventory: { include: { warehouses: true } }, // Lấy tồn kho chi tiết từng kho
      },
    });

    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');
    return product;
  }

  // 4. CẬP NHẬT (PUT)
  async update(id: number, dto: UpdateProductDto) {
    // 1. Check xem sản phẩm có tồn tại không
    await this.findOne(id);

    // 2. Dùng Transaction để đảm bảo tính nhất quán
    return this.prisma.$transaction(async (tx) => {
      const productId = BigInt(id);

      // A. Cập nhật thông tin cơ bản (Parent)
      const product = await tx.products.update({
        where: { id: productId },
        data: {
          name: dto.name,
          retail_price: dto.retail_price,
          cost_price: dto.cost_price,
          brand: dto.brand,
          unit: dto.unit,
          // Convert category_id sang BigInt nếu có gửi lên
          ...(dto.category_id && { category_id: BigInt(dto.category_id) }),
        },
      });

      // B. Xử lý Xe tương thích (Compatibility)
      // Logic: Nếu mảng này được gửi lên (kể cả mảng rỗng), ta Xóa Hết Cũ -> Thêm Mới
      if (dto.compatibility) {
        // B1. Xóa cũ
        await tx.product_compatibility.deleteMany({
          where: { product_id: productId },
        });

        // B2. Thêm mới (Nếu mảng có dữ liệu)
        if (dto.compatibility.length > 0) {
          await tx.product_compatibility.createMany({
            data: dto.compatibility.map((item) => ({
              product_id: productId,
              car_make: item.car_make,
              car_model: item.car_model,
              year_start: item.year_start,
              year_end: item.year_end,
            })),
          });
        }
      }

      // C. Xử lý Tồn kho (Inventory) - Cẩn thận khi dùng cái này
      // Logic: Reset lại tồn kho theo số lượng user nhập (Admin sửa trực tiếp)
      if (dto.inventory) {
        // C1. Xóa cũ
        await tx.inventory.deleteMany({
          where: { product_id: productId },
        });

        // C2. Thêm mới
        if (dto.inventory.length > 0) {
          await tx.inventory.createMany({
            data: dto.inventory.map((item) => ({
              product_id: productId,
              warehouse_id: BigInt(item.warehouse_id),
              quantity: item.quantity,
            })),
          });
        }
      }

      return product;
    });
  }
}
