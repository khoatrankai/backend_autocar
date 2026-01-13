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
    // 1. Kiểm tra trùng SKU
    const exist = await this.prisma.products.findUnique({
      where: { sku: dto.sku },
    });
    if (exist) throw new BadRequestException(`Mã SKU '${dto.sku}' đã tồn tại`);

    // 2. Transaction
    return this.prisma.$transaction(async (tx) => {
      // A. Tạo sản phẩm chính (Map đầy đủ field mới)
      const product = await tx.products.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          oem_code: dto.oem_code, // Mới thêm
          brand: dto.brand,
          unit: dto.unit,
          cost_price: dto.cost_price,
          retail_price: dto.retail_price,
          min_stock_alert: dto.min_stock_alert, // Mới thêm
          image_url: dto.image_url, // Mới thêm

          // Xử lý khóa ngoại BigInt (nếu có gửi lên)
          category_id: dto.category_id ? BigInt(dto.category_id) : undefined,
          supplier_id: dto.supplier_id ? BigInt(dto.supplier_id) : undefined, // Mới thêm
        },
      });

      // B. Thêm danh sách xe tương thích
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

      // C. Khởi tạo tồn kho ban đầu
      if (dto.inventory && dto.inventory.length > 0) {
        await tx.inventory.createMany({
          data: dto.inventory.map((item) => ({
            product_id: product.id,
            warehouse_id: BigInt(item.warehouse_id), // Nhớ convert BigInt
            quantity: item.quantity,
          })),
        });
      }

      return product;
    });
  }

  // 2. LẤY DANH SÁCH (PAGINATION + SEARCH)
  async findAll(query: FilterProductDto) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      supplierId,
      stockStatus,
      brand,
      location,
      createdAtFrom,
      createdAtTo,
    } = query;

    const skip = (page - 1) * limit;

    // Khởi tạo điều kiện lọc
    const whereCondition: any = {
      AND: [],
    };

    // 1. Tìm kiếm chung (Tên hoặc SKU)
    if (search) {
      whereCondition.AND.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // 2. Lọc theo Nhóm hàng (Category)
    if (categoryId) {
      whereCondition.AND.push({ category_id: BigInt(categoryId) });
    }

    // 3. Lọc theo Nhà cung cấp (Supplier)
    if (supplierId) {
      whereCondition.AND.push({ supplier_id: BigInt(supplierId) });
    }

    // 4. Lọc theo Thương hiệu (Dựa vào bảng product_compatibility)
    if (brand) {
      whereCondition.AND.push({
        product_compatibility: {
          some: {
            car_make: { contains: brand, mode: 'insensitive' },
          },
        },
      });
    }

    // 5. Lọc theo Vị trí & Tồn kho (Dựa vào bảng inventory)
    // Lưu ý: Nếu user chọn cả Vị trí và Trạng thái tồn, ta gom vào chung relation inventory
    if (location || stockStatus) {
      const inventoryFilter: any = {};

      // Lọc vị trí
      if (location) {
        inventoryFilter.location_code = {
          contains: location,
          mode: 'insensitive',
        };
      }

      // Lọc tồn kho (Còn hàng / Hết hàng)
      if (stockStatus === 'in_stock') {
        inventoryFilter.quantity = { gt: 0 }; // Lớn hơn 0
        whereCondition.AND.push({ inventory: { some: inventoryFilter } });
      } else if (stockStatus === 'out_of_stock') {
        // Hết hàng: Không có inventory nào > 0 hoặc inventory = 0
        // Cách đơn giản nhất trong Prisma: Không có bản ghi inventory nào thỏa mãn quantity > 0
        // Hoặc tìm sản phẩm mà mọi inventory đều <= 0
        // Ở đây dùng logic: Lọc các sp mà inventory quantity <= 0
        inventoryFilter.quantity = { lte: 0 };
        whereCondition.AND.push({ inventory: { some: inventoryFilter } });

        // Lưu ý: Logic "Hết hàng" chuẩn có thể phức tạp hơn (VD: không có record inventory nào),
        // nhưng với cấu trúc hiện tại thì inventory thường luôn được tạo khi import.
      } else if (location) {
        // Nếu chỉ lọc location mà không lọc stockStatus
        whereCondition.AND.push({ inventory: { some: inventoryFilter } });
      }
    }

    // 6. Lọc theo Thời gian tạo (Created At)
    if (createdAtFrom || createdAtTo) {
      const dateFilter: any = {};
      if (createdAtFrom) dateFilter.gte = new Date(createdAtFrom);
      if (createdAtTo) dateFilter.lte = new Date(createdAtTo);

      whereCondition.AND.push({ created_at: dateFilter });
    }

    // --- THỰC THI QUERY ---
    const [data, total] = await Promise.all([
      this.prisma.products.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          categories: { select: { name: true } }, // Lấy tên nhóm hàng
          supplier: { select: { name: true } }, // Lấy tên nhà cung cấp
          inventory: {
            // Lấy tồn kho và vị trí
            select: {
              quantity: true,
              location_code: true,
              warehouses: { select: { name: true } },
            },
          },
          product_compatibility: {
            // Lấy thương hiệu xe tương thích
            select: {
              car_make: true,
              car_model: true,
              year_start: true,
              year_end: true,
            },
          },
        },
      }),
      this.prisma.products.count({ where: whereCondition }),
    ]);

    // Format lại dữ liệu trả về cho đẹp (Flatten data) nếu cần thiết
    const formattedData = data.map((item) => ({
      ...item,
      // Tính tổng tồn kho từ mảng inventory
      total_quantity: item.inventory.reduce(
        (sum, inv) => sum + (inv.quantity || 0),
        0,
      ),
      // Lấy danh sách vị trí
      locations: item.inventory
        .map((inv) => inv.location_code)
        .filter(Boolean)
        .join(', '),
      // Format tên xe
      compatibility: item.product_compatibility
        .map((c) => `${c.car_make} ${c.car_model}`)
        .join(', '),
    }));

    return {
      data: formattedData, // Trả về data đã format
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
    // 1. Check tồn tại
    // Giả sử hàm findOne ném lỗi NotFoundException nếu không thấy
    await this.findOne(id);

    const productId = BigInt(id);

    return this.prisma.$transaction(async (tx) => {
      // A. Cập nhật thông tin cha
      const product = await tx.products.update({
        where: { id: productId },
        data: {
          name: dto.name,
          sku: dto.sku, // Cho phép sửa SKU nếu cần (cần cẩn thận logic này)
          oem_code: dto.oem_code,
          brand: dto.brand,
          unit: dto.unit,
          cost_price: dto.cost_price,
          retail_price: dto.retail_price,
          min_stock_alert: dto.min_stock_alert,
          image_url: dto.image_url,

          // Cập nhật quan hệ (nếu user gửi null/undefined thì Prisma sẽ bỏ qua nhờ cú pháp spread object dưới đây)
          ...(dto.category_id && { category_id: BigInt(dto.category_id) }),
          ...(dto.supplier_id && { supplier_id: BigInt(dto.supplier_id) }),
        },
      });

      // B. Xử lý Compatibility (Chiến thuật: Xóa hết -> Thêm lại)
      if (dto.compatibility) {
        await tx.product_compatibility.deleteMany({
          where: { product_id: productId },
        });

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

      // C. Xử lý Inventory (CẢNH BÁO: Chỉ dùng khi muốn Reset kho cứng)
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
