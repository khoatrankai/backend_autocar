import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service'; // Check đường dẫn
import { CreateProductDto } from './dto/create-product.dto';
import {
  DateRangeType,
  FilterAdvanceProductDto,
  FilterProductDto,
  StockStatus,
} from './dto/filter-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import { PosSearchProductDto } from './dto/pos-search-product.dto';

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

  async findAllAdvance(query: FilterAdvanceProductDto) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryIds,
      supplierIds,
      brandIds,
      locationIds,
      stockStatus,

      // Các biến mới
      createdDateType,
      createdFrom, // thay vì createdDateRange
      createdTo,

      stockoutDateType,
      stockoutFrom, // thay vì stockoutDateRange
      stockoutTo,
    } = query;

    const skip = (page - 1) * limit;

    // --- 1. KHỞI TẠO ĐIỀU KIỆN LỌC (WHERE) ---
    // Sử dụng 'Prisma.productsWhereInput' để đảm bảo type-safe
    const where: Prisma.productsWhereInput = {
      AND: [],
    };

    // Ép kiểu để Typescript hiểu mảng này chứa các điều kiện con
    const andConditions = where.AND as Prisma.productsWhereInput[];

    // --- 2. XỬ LÝ TỪNG ĐIỀU KIỆN ---

    // 2.1. Tìm kiếm (Search Text)
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          // { oem_code: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // 2.2. Nhóm hàng (Multi-Select IDs - BigInt)
    if (categoryIds && categoryIds.length > 0) {
      andConditions.push({
        category_id: { in: categoryIds.map((id) => BigInt(id)) },
      });
    }

    // 2.3. Nhà cung cấp (Multi-Select IDs - BigInt)
    if (supplierIds && supplierIds.length > 0) {
      andConditions.push({
        supplier_id: { in: supplierIds.map((id) => BigInt(id)) },
      });
    }

    // 2.4. Thương hiệu (String)
    // Lọc cả trong bảng Products lẫn bảng ProductCompatibility (xe tương thích)
    if (brandIds && brandIds.length > 0) {
      andConditions.push({
        OR: [
          { brand: { in: brandIds, mode: 'insensitive' } },
          {
            product_compatibility: {
              some: {
                car_make: { in: brandIds, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    // 2.5. Vị trí kho & Trạng thái tồn kho (Relation Filter)
    if (
      stockStatus !== StockStatus.ALL ||
      (locationIds && locationIds.length > 0)
    ) {
      const inventoryWhere: Prisma.InventoryListRelationFilter = {};

      // A. Lọc theo Vị trí (Location Code)
      if (locationIds && locationIds.length > 0) {
        // Dùng Object.assign để merge điều kiện nếu 'some' đã tồn tại
        inventoryWhere.some = Object.assign(inventoryWhere.some || {}, {
          location_code: { in: locationIds },
        });
      }

      // B. Lọc theo Trạng thái tồn (Stock Status)
      if (stockStatus === StockStatus.IN_STOCK) {
        // Có tồn kho: Có ít nhất 1 bản ghi inventory > 0
        inventoryWhere.some = Object.assign(inventoryWhere.some || {}, {
          quantity: { gt: 0 },
        });
      } else if (stockStatus === StockStatus.OUT_OF_STOCK) {
        // Hết hàng: Không có bản ghi inventory nào > 0
        // (Lưu ý: Logic này tương đương với việc tất cả các kho đều <= 0 hoặc chưa có record inventory)
        inventoryWhere.none = { quantity: { gt: 0 } };

        // *Edge Case:* Nếu vừa chọn Vị trí cụ thể, vừa chọn Hết hàng
        // Nghĩa là: Tại vị trí X, sản phẩm này số lượng <= 0
        if (locationIds && locationIds.length > 0) {
          delete inventoryWhere.none; // Xóa điều kiện none ở trên
          inventoryWhere.some = {
            location_code: { in: locationIds },
            quantity: { lte: 0 },
          };
        }
      } else if (stockStatus === StockStatus.LOW_STOCK) {
        // Dưới định mức (Tạm tính là <= 5)
        inventoryWhere.some = Object.assign(inventoryWhere.some || {}, {
          quantity: { lte: 5, gt: 0 },
        });
      }

      // Chỉ push vào AND nếu có điều kiện inventory
      if (Object.keys(inventoryWhere).length > 0) {
        andConditions.push({ inventory: inventoryWhere });
      }
    }

    // 2.6. Ngày tạo (Created At)
    if (
      createdDateType === DateRangeType.CUSTOM &&
      (createdFrom || createdTo)
    ) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (createdFrom) dateFilter.gte = new Date(createdFrom);
      if (createdTo) dateFilter.lte = new Date(createdTo);

      if (Object.keys(dateFilter).length > 0) {
        andConditions.push({ created_at: dateFilter });
      }
    }

    // --- SỬA LOGIC DỰ KIẾN HẾT HÀNG ---
    if (
      stockoutDateType === DateRangeType.CUSTOM &&
      (stockoutFrom || stockoutTo)
    ) {
      const today = new Date();
      const numberFilter: Prisma.DecimalFilter = {};

      if (stockoutFrom) {
        const diffDays = this.calculateDiffDays(today, new Date(stockoutFrom));
        numberFilter.gte = diffDays;
      }

      if (stockoutTo) {
        const diffDays = this.calculateDiffDays(today, new Date(stockoutTo));
        numberFilter.lte = diffDays;
      }

      if (Object.keys(numberFilter).length > 0) {
        andConditions.push({ estimated_stockout_days: numberFilter });
      }
    }

    // --- 3. THỰC THI QUERY ---
    const [data, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          categories: { select: { name: true } },
          supplier: { select: { name: true } }, // Relation: ProductSupplier
          inventory: {
            select: {
              quantity: true,
              location_code: true,
              warehouses: { select: { name: true } },
            },
          },
          product_compatibility: {
            select: {
              car_make: true,
              car_model: true,
            },
          },
        },
      }),
      this.prisma.products.count({ where }),
    ]);

    // --- 4. FORMAT DỮ LIỆU TRẢ VỀ ---
    const formattedData = data.map((item) => ({
      ...item,
      // Convert BigInt & Decimal sang String/Number để tránh lỗi JSON
      id: item.id.toString(),
      category_id: item.category_id?.toString(),
      supplier_id: item.supplier_id?.toString(),
      cost_price: Number(item.cost_price),
      retail_price: Number(item.retail_price),
      average_daily_sales: Number(item.average_daily_sales),
      estimated_stockout_days: Number(item.estimated_stockout_days),

      // Flatten Data cho Frontend dễ hiển thị
      category_name: item.categories?.name,
      supplier_name: item.supplier?.name,

      // Tính tổng tồn kho
      total_quantity: item.inventory.reduce(
        (sum, inv) => sum + (inv.quantity || 0),
        0,
      ),

      // Danh sách vị trí (Unique)
      locations: [
        ...new Set(item.inventory.map((i) => i.location_code).filter(Boolean)),
      ].join(', '),

      // Danh sách xe tương thích
      compatibility: item.product_compatibility
        .map((c) => `${c.car_make} ${c.car_model}`)
        .join(', '),
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // --- HELPER FUNCTIONS ---

  // Hàm tính khoảng cách ngày (trả về số ngày)

  // Helper tính số ngày
  private calculateDiffDays(d1: Date, d2: Date): number {
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // 3. CHI TIẾT SẢN PHẨM
  async findOne(id: number) {
    const product = await this.prisma.products.findUnique({
      where: { id: BigInt(id) },
      include: {
        categories: true,
        product_compatibility: true,
        inventory: { include: { warehouses: true } },
        supplier: true, // <--- THÊM DÒNG NÀY (Lấy thông tin nhà cung cấp)
      },
    });

    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

    // Convert BigInt sang string/number để frontend dễ dùng nếu cần (hoặc dùng interceptor)
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

  async updateSalesMetrics() {
    return this.prisma.$executeRaw`SELECT calculate_sales_metrics();`;
  }

  async getBrands() {
    // 1. Lấy tất cả các brand distinct (không trùng) từ bảng products
    const brands = await this.prisma.products.findMany({
      select: { brand: true },
      distinct: ['brand'], // Chỉ lấy các giá trị duy nhất
      where: {
        brand: { not: null }, // Bỏ qua các sản phẩm không có brand
      },
      orderBy: { brand: 'asc' }, // Sắp xếp A-Z
    });

    // 2. Format lại dữ liệu trả về (Mảng string đơn giản)
    // Kết quả gốc: [{ brand: "Samsung" }, { brand: "Apple" }]
    // Kết quả mong muốn: ["Samsung", "Apple"]
    const distinctBrands = brands
      .map((item) => item.brand)
      .filter((b) => b !== ''); // Lọc bỏ chuỗi rỗng nếu có

    return {
      statusCode: 200,
      message: 'Lấy danh sách thương hiệu thành công',
      data: distinctBrands,
    };
  }

  async removeMultiple(ids: number[]) {
    // Chuyển đổi ID nếu cần (vì DB là BigInt, DTO nhận vào là number/string)
    // Nếu DB dùng BigInt, bạn cần map sang BigInt
    const bigIntIds = ids.map((id) => BigInt(id));

    const result = await this.prisma.products.deleteMany({
      where: {
        id: { in: bigIntIds },
      },
    });

    return {
      statusCode: 200,
      message: `Đã xóa thành công ${result.count} sản phẩm`,
    };
  }

  async getStockCard(productId: string) {
    const logs = await this.prisma.inventory_logs.findMany({
      where: {
        product_id: BigInt(productId),
      },
      include: {
        warehouses: { select: { name: true } }, // Lấy tên kho
      },
      orderBy: {
        created_at: 'desc', // Mới nhất lên đầu
      },
    });

    // Map dữ liệu cho Frontend dễ dùng
    return logs.map((log) => ({
      id: log.id.toString(),
      thoi_gian: log.created_at,
      loai_gd: log.type, // 'purchase', 'sale', 'return'...
      chung_tu: log.reference_code,
      kho: log.warehouses?.name,
      so_luong: log.change_amount, // Số dương hoặc âm có sẵn trong DB
      ton_cuoi: log.balance_after, // DB đã tính sẵn, chỉ việc hiện
      dien_giai: log.note,
    }));
  }

  async getInventoryDetail(productId: string) {
    const id = BigInt(productId);

    // 1. Lấy thông tin sản phẩm (để lấy tốc độ bán trung bình)
    const product = await this.prisma.products.findUnique({
      where: { id },
      select: { average_daily_sales: true },
    });

    // 2. Lấy danh sách tất cả kho hàng
    const warehouses = await this.prisma.warehouses.findMany({
      select: { id: true, name: true },
    });

    // 3. Tính toán số liệu cho từng kho
    const result = await Promise.all(
      warehouses.map(async (warehouse) => {
        // A. Lấy Tồn kho hiện tại (Bảng inventory)
        const inventory = await this.prisma.inventory.findUnique({
          where: {
            product_id_warehouse_id: {
              product_id: id,
              warehouse_id: warehouse.id,
            },
          },
        });
        const currentStock = inventory?.quantity || 0;

        // B. Tính "KH Đặt" (Hàng đang trong đơn pending/processing)
        // Lưu ý: Logic này giả định bạn có status khác 'completed'.
        // Nếu đơn tạo xong là trừ kho luôn và status='completed', thì KH Đặt = 0.
        const onOrderAgg = await this.prisma.order_items.aggregate({
          _sum: { quantity: true },
          where: {
            product_id: id,
            orders: {
              warehouse_id: warehouse.id,
              // Chỉ tính các đơn chưa hoàn thành/đang giao
              status: { in: ['pending', 'processing'] },
            },
          },
        });
        const onOrder = Number(onOrderAgg._sum.quantity || 0);

        // C. Tính "Dự kiến hết hàng"
        // Công thức: Tồn kho / Tốc độ bán (average_daily_sales)
        const avgSales = Number(product?.average_daily_sales || 0);
        let forecastDays = 0;
        if (avgSales > 0 && currentStock > 0) {
          forecastDays = Math.floor(currentStock / avgSales);
        }

        // D. Xác định Trạng thái
        let status = 'Ngừng kinh doanh';
        if (currentStock > 0) status = 'Đang kinh doanh';
        else if (onOrder > 0) status = 'Đang nhập hàng'; // Ví dụ logic thêm

        return {
          warehouse_name: warehouse.name,
          quantity: currentStock, // Cột Tồn kho
          on_order: onOrder, // Cột KH đặt
          forecast_days: forecastDays, // Cột Dự kiến hết hàng
          status: status, // Cột Trạng thái
        };
      }),
    );

    return result;
  }

  async posSearch(query: PosSearchProductDto) {
    const { keyword, car_model } = query;

    // Build the WHERE clause dynamically
    const where: any = {};

    // 1. Keyword Search (Name or SKU)
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { sku: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 2. Car Model Filter (using relation product_compatibility)
    if (car_model) {
      where.product_compatibility = {
        some: {
          car_model: { contains: car_model, mode: 'insensitive' },
        },
      };
    }

    // Execute Query
    const products = await this.prisma.products.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        retail_price: true,
        unit: true,
        image_url: true,
        // Include inventory details
        inventory: {
          select: {
            quantity: true,
            warehouses: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: 20, // Limit results for performance (POS usually needs quick lists)
    });

    // Transform Data to match the requested Response Structure
    return products.map((product) => {
      // Calculate total inventory
      const inventory_total = product.inventory.reduce(
        (sum, item) => sum + (item.quantity || 0),
        0,
      );

      // Map detailed inventory per warehouse
      const inventory_details = product.inventory.map((inv) => ({
        warehouse_name: inv.warehouses?.name || 'Unknown Warehouse',
        quantity: inv.quantity || 0,
      }));

      return {
        id: product.id.toString(), // Convert BigInt to String
        name: product.name,
        sku: product.sku,
        retail_price: Number(product.retail_price), // Convert Decimal to Number
        unit: product.unit,
        image_url: product.image_url,
        inventory_total,
        inventory_details,
      };
    });
  }
}
