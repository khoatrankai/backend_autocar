import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import * as ExcelJS from 'exceljs';
// Removed: import { Readable } from 'stream'; (Not needed for .load())

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  // ====================================================================
  // 1. IMPORT PRODUCTS
  // ====================================================================
  async importProducts(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng upload file Excel');

    const workbook = new ExcelJS.Workbook();

    // Explicitly use the buffer. If type issues arise, cast to Buffer.
    // ExcelJS .load() accepts Buffer.
    await workbook.xlsx.load(file.buffer as any);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException(
        'File Excel không hợp lệ hoặc không có dữ liệu',
      );
    }

    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const categoryCache = new Map<string, bigint>();

    // Iterate over rows starting from row 2 (skipping header)
    // worksheet.eachRow is often safer than a for loop with rowCount for large sparse sheets,
    // but the loop logic you have is fine for standard data.
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      // Helper to safely get cell text
      const getCellText = (colIndex: number) => {
        const cell = row.getCell(colIndex);
        return cell.text ? cell.text.toString().trim() : '';
      };

      const rawSku = getCellText(3);
      const rawName = getCellText(4);

      if (!rawSku) continue;

      results.total++;

      try {
        await this.prisma.$transaction(async (tx) => {
          // A. CATEGORY
          const rawCategory = getCellText(2) || 'Hàng hóa chung';
          const categoryId = await this.resolveCategoryChain(
            tx,
            rawCategory,
            categoryCache,
          );

          // B. PRODUCT
          const productData = {
            name: rawName || 'Chưa đặt tên',
            brand: getCellText(5),
            retail_price: this.parseNumber(row.getCell(6).value),
            cost_price: this.parseNumber(row.getCell(7).value),
            min_stock_alert: this.parseNumber(row.getCell(11).value) || 5,
            unit: getCellText(13) || 'Cái',
            category_id: categoryId,
          };

          const product = await tx.products.upsert({
            where: { sku: rawSku },
            update: productData,
            create: {
              sku: rawSku,
              ...productData,
            },
          });

          // C. COMPATIBILITY
          const rawCar = getCellText(5);
          if (rawCar) {
            const { make, model, yearStart, yearEnd } =
              this.parseCarString(rawCar);

            await tx.product_compatibility.deleteMany({
              where: { product_id: product.id },
            });
            await tx.product_compatibility.create({
              data: {
                product_id: product.id,
                car_make: make,
                car_model: model,
                year_start: yearStart,
                year_end: yearEnd,
              },
            });
          }

          // D. INVENTORY
          const quantity = this.parseNumber(row.getCell(8).value);
          if (quantity > 0) {
            const warehouseId = 1n; // Default warehouse ID
            const existingStock = await tx.inventory.findUnique({
              where: {
                product_id_warehouse_id: {
                  product_id: product.id,
                  warehouse_id: warehouseId,
                },
              },
            });

            if (existingStock) {
              await tx.inventory.update({
                where: { id: existingStock.id },
                data: { quantity: quantity },
              });
            } else {
              await tx.inventory.create({
                data: {
                  product_id: product.id,
                  warehouse_id: warehouseId,
                  quantity: quantity,
                },
              });
            }
          }
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Dòng ${rowNumber} (SKU: ${rawSku}): ${error.message}`,
        );
      }
    }

    return results;
  }

  // ====================================================================
  // 2. GENERATE TEMPLATE
  // ====================================================================
  async generateProductTemplate() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh muc hang hoa');

    worksheet.columns = [
      { header: 'Loại hàng', key: 'type', width: 15 },
      { header: 'Nhóm hàng', key: 'category', width: 35 },
      { header: 'Mã hàng', key: 'sku', width: 20 },
      { header: 'Tên hàng', key: 'name', width: 40 },
      { header: 'Thương hiệu', key: 'brand', width: 25 },
      { header: 'Giá bán', key: 'retail_price', width: 15 },
      { header: 'Giá vốn', key: 'cost_price', width: 15 },
      { header: 'Tồn kho', key: 'quantity', width: 10 },
      { header: 'KH đặt', key: 'customer_order', width: 10 },
      { header: 'Dự kiến hết hàng', key: 'expected', width: 15 },
      { header: 'Tồn nhỏ nhất', key: 'min_stock', width: 12 },
      { header: 'Tồn lớn nhất', key: 'max_stock', width: 12 },
      { header: 'ĐVT', key: 'unit', width: 10 },
      { header: 'Mã ĐVT Cơ bản', key: 'unit_code', width: 15 },
      { header: 'Quy đổi', key: 'exchange', width: 10 },
      { header: 'Hình ảnh (url1,url2...)', key: 'image', width: 25 },
      { header: 'Trọng lượng', key: 'weight', width: 12 },
      { header: 'Đang kinh doanh', key: 'active', width: 15 },
      { header: 'Được bán trực tiếp', key: 'direct_sell', width: 15 },
      { header: 'Mô tả', key: 'desc', width: 20 },
    ];

    worksheet.addRow({
      type: 'Hàng hóa',
      category: 'PHỤ TÙNG Ô TÔ>>BODY>>DÂY CÁP',
      sku: '464200D131.',
      name: 'DÂY CÁP PHANH TAY',
      brand: 'vios e-g 2008',
      retail_price: 0,
      cost_price: 420000,
      quantity: 10,
      unit: 'CÁI',
      active: 1,
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' },
    };

    return await workbook.xlsx.writeBuffer();
  }

  // ====================================================================
  // 3. EXPORT
  // ====================================================================
  async exportProducts(selectedColumns: string[] | null) {
    // 1. Lấy dữ liệu từ DB (Giữ nguyên để đảm bảo có đủ data cho các trường calculated)
    const products = await this.prisma.products.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        categories: {
          include: {
            categories: {
              include: { categories: true },
            },
          },
        },
        product_compatibility: true,
        inventory: true,
      },
    });

    // 2. ĐỊNH NGHĨA CẤU HÌNH CỘT VÀ LOGIC TRANSFORM DỮ LIỆU
    // Key của object này phải khớp với key mà Frontend gửi lên
    const COLUMN_DEFINITIONS: Record<
      string,
      { header: string; width: number; transform: (p: any) => any }
    > = {
      type: {
        header: 'Loại hàng',
        width: 15,
        transform: () => 'Hàng hóa',
      },
      category: {
        header: 'Nhóm hàng',
        width: 35,
        transform: (p) => {
          if (!p.categories) return '';
          const catLvl1 = p.categories;
          const catLvl2 = catLvl1.categories;
          const catLvl3 = catLvl2?.categories;
          if (catLvl3)
            return `${catLvl3.name}>>${catLvl2.name}>>${catLvl1.name}`;
          if (catLvl2) return `${catLvl2.name}>>${catLvl1.name}`;
          return catLvl1.name;
        },
      },
      sku: {
        header: 'Mã hàng',
        width: 20,
        transform: (p) => p.sku,
      },
      name: {
        header: 'Tên hàng',
        width: 40,
        transform: (p) => p.name,
      },
      brand: {
        header: 'Thương hiệu',
        width: 25,
        transform: (p) => {
          // Logic lấy xe tương thích làm thương hiệu (như code cũ của bạn)
          const compatibility = p.product_compatibility || [];
          if (compatibility.length > 0) {
            const car = compatibility[0];
            const year = car.year_end
              ? `${car.year_start}-${car.year_end}`
              : `${car.year_start || ''}`;
            return `${car.car_make} ${car.car_model} ${year}`.trim();
          }
          return p.brand || ''; // Fallback về brand gốc nếu không có xe
        },
      },
      retail_price: {
        header: 'Giá bán',
        width: 15,
        transform: (p) => Number(p.retail_price),
      },
      cost_price: {
        header: 'Giá vốn',
        width: 15,
        transform: (p) => Number(p.cost_price),
      },
      quantity: {
        header: 'Tồn kho',
        width: 10,
        transform: (p) =>
          p.inventory?.reduce((sum, item) => sum + (item.quantity || 0), 0) ||
          0,
      },
      customer_order: {
        header: 'KH đặt',
        width: 10,
        transform: () => 0,
      },
      expected: {
        header: 'Dự kiến hết hàng',
        width: 15,
        transform: () => '0 ngày',
      },
      min_stock: {
        header: 'Tồn nhỏ nhất',
        width: 12,
        transform: (p) => p.min_stock_alert || 0,
      },
      max_stock: {
        header: 'Tồn lớn nhất',
        width: 12,
        transform: () => 999999,
      },
      unit: {
        header: 'ĐVT',
        width: 10,
        transform: (p) => p.unit,
      },
      unit_code: {
        header: 'Mã ĐVT Cơ bản',
        width: 15,
        transform: () => '',
      },
      exchange: {
        header: 'Quy đổi',
        width: 10,
        transform: () => 1,
      },
      image: {
        header: 'Hình ảnh',
        width: 25,
        transform: (p) => p.image_url || '',
      },
      weight: {
        header: 'Trọng lượng',
        width: 12,
        transform: () => '',
      },
      active: {
        header: 'Đang kinh doanh',
        width: 15,
        transform: () => 1,
      },
      direct_sell: {
        header: 'Được bán trực tiếp',
        width: 15,
        transform: () => 1,
      },
      desc: {
        header: 'Mô tả',
        width: 20,
        transform: (p) => p.description || '',
      },
      location: {
        header: 'Vị trí',
        width: 20,
        transform: (p) =>
          [
            ...new Set(p.inventory.map((i) => i.location_code).filter(Boolean)),
          ].join(', '),
      },
    };

    // 3. XÁC ĐỊNH CÁC CỘT CẦN XUẤT
    // Nếu frontend không gửi columns (hoặc mảng rỗng), mặc định xuất TẤT CẢ
    // Lưu ý: Cần lọc bỏ những key mà frontend gửi lên nhưng không có trong COLUMN_DEFINITIONS để tránh lỗi
    let activeKeys: string[] = [];

    if (selectedColumns && selectedColumns.length > 0) {
      activeKeys = selectedColumns.filter((key) => COLUMN_DEFINITIONS[key]);
    } else {
      activeKeys = Object.keys(COLUMN_DEFINITIONS);
    }

    // 4. KHỞI TẠO EXCEL
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sach hang hoa');

    // 5. THIẾT LẬP HEADER ĐỘNG
    worksheet.columns = activeKeys.map((key) => ({
      header: COLUMN_DEFINITIONS[key].header,
      key: key,
      width: COLUMN_DEFINITIONS[key].width,
    }));

    // Style cho Header (Giữ nguyên)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' },
    };

    // 6. DUYỆT QUA SẢN PHẨM VÀ ĐỔ DỮ LIỆU
    products.forEach((product) => {
      const rowData: any = {};

      // Chỉ tính toán dữ liệu cho các cột được chọn (Tối ưu hiệu năng)
      activeKeys.forEach((key) => {
        const config = COLUMN_DEFINITIONS[key];
        if (config) {
          rowData[key] = config.transform(product);
        }
      });

      worksheet.addRow(rowData);
    });

    return await workbook.xlsx.writeBuffer();
  }

  // ====================================================================
  // HELPERS
  // ====================================================================

  private async resolveCategoryChain(
    tx: any,
    categoryPath: string,
    cache: Map<string, bigint>,
  ): Promise<bigint> {
    if (cache.has(categoryPath)) return cache.get(categoryPath)!;
    const parts = categoryPath.split('>>').map((p) => p.trim());
    let parentId: bigint | null = null;

    for (const partName of parts) {
      if (!partName) continue;
      const existing = await tx.categories.findFirst({
        where: { name: partName, parent_id: parentId },
        select: { id: true },
      });
      if (existing) {
        parentId = existing.id;
      } else {
        const newCat = await tx.categories.create({
          data: {
            name: partName,
            parent_id: parentId,
            slug: this.toSlug(partName),
          },
          select: { id: true },
        });
        parentId = newCat.id;
      }
    }

    if (parentId) cache.set(categoryPath, parentId);
    return parentId!;
  }

  private parseCarString(input: string) {
    const regex = /^(.*?)\s+(\d{4})(?:\s*-\s*(\d{4}))?$/;
    const match = input.match(regex);
    if (match) {
      const fullText = match[1].trim();
      const firstSpaceIndex = fullText.indexOf(' ');
      let make = 'Unknown',
        model = fullText;
      if (firstSpaceIndex > 0) {
        make = fullText.substring(0, firstSpaceIndex);
        model = fullText.substring(firstSpaceIndex + 1);
      } else {
        make = fullText;
        model = '';
      }
      return {
        make,
        model,
        yearStart: parseInt(match[2]),
        yearEnd: match[3] ? parseInt(match[3]) : null,
      };
    }
    return {
      make: input.split(' ')[0] || 'Unknown',
      model: input.substring(input.indexOf(' ') + 1) || input,
      yearStart: null,
      yearEnd: null,
    };
  }

  private parseNumber(value: any): number {
    if (!value) return 0;
    const strVal = String(value).replace(/,/g, '');
    const num = Number(strVal);
    return isNaN(num) ? 0 : num;
  }

  private toSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
  }

  async importSuppliers(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng upload file Excel');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException(
        'File Excel không hợp lệ hoặc không có dữ liệu',
      );
    }

    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const getCellText = (colIndex: number) => {
        const cell = row.getCell(colIndex);
        return cell.text ? cell.text.toString().trim() : '';
      };

      // Mapping cột theo file mẫu (Giả định thứ tự cột)
      // 1: Mã NCC, 2: Tên NCC, 3: Nhóm NCC, 4: SĐT, 5: Email, 6: Địa chỉ, 7: Nợ đầu kỳ, 8: Ghi chú
      const rawCode = getCellText(1);
      const rawName = getCellText(2);

      if (!rawName) continue; // Tên là bắt buộc

      results.total++;

      try {
        await this.prisma.$transaction(async (tx) => {
          // A. Xử lý Mã NCC (Nếu không có thì tự sinh hoặc bỏ qua)
          const supplierCode = rawCode || `NCC${Date.now()}${rowNumber}`;

          // B. Xử lý Nhóm NCC (Tạo mới nếu chưa có group_name trong DB partner)
          // Với cấu trúc hiện tại partner.group_name là string, ta chỉ cần lưu string.
          const groupName = getCellText(3) || null;

          // C. Tạo/Update Supplier
          const supplierData = {
            name: rawName,
            phone: getCellText(4),
            email: getCellText(5),
            address: getCellText(6),
            group_name: groupName,
            current_debt: this.parseNumber(row.getCell(7).value), // Nợ đầu kỳ -> gán vào nợ hiện tại
            notes: getCellText(8),
            type: 'supplier', // Cố định type
            status: 'active',
          };

          // Dùng upsert theo code
          await tx.partners.upsert({
            where: { code: supplierCode },
            update: supplierData,
            create: {
              code: supplierCode,
              ...supplierData,
            },
          });
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Dòng ${rowNumber} (${rawName}): ${error.message}`);
      }
    }

    return results;
  }
  async exportSuppliers(selectedColumns: string[] | null) {
    // 1. Lấy dữ liệu từ DB (Chỉ lấy type = supplier)
    const suppliers = await this.prisma.partners.findMany({
      where: { type: 'supplier' },
      orderBy: { created_at: 'desc' },
    });

    // 2. Định nghĩa cấu hình cột
    const COLUMN_DEFINITIONS: Record<
      string,
      { header: string; width: number; transform: (p: any) => any }
    > = {
      code: {
        header: 'Mã NCC',
        width: 15,
        transform: (p) => p.code,
      },
      name: {
        header: 'Tên nhà cung cấp',
        width: 30,
        transform: (p) => p.name,
      },
      group_name: {
        header: 'Nhóm NCC',
        width: 20,
        transform: (p) => p.group_name || '',
      },
      phone: {
        header: 'Điện thoại',
        width: 15,
        transform: (p) => p.phone || '',
      },
      email: {
        header: 'Email',
        width: 25,
        transform: (p) => p.email || '',
      },
      address: {
        header: 'Địa chỉ',
        width: 35,
        transform: (p) => p.address || '',
      },
      current_debt: {
        header: 'Nợ hiện tại',
        width: 15,
        transform: (p) => Number(p.current_debt),
      },
      total_revenue: {
        header: 'Tổng mua',
        width: 15,
        transform: (p) => Number(p.total_revenue),
      },
      status: {
        header: 'Trạng thái',
        width: 15,
        transform: (p) =>
          p.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động',
      },
      notes: {
        header: 'Ghi chú',
        width: 25,
        transform: (p) => p.notes || '',
      },
    };

    // 3. Xử lý cột được chọn
    let activeKeys: string[] = [];
    if (selectedColumns && selectedColumns.length > 0) {
      activeKeys = selectedColumns.filter((key) => COLUMN_DEFINITIONS[key]);
    } else {
      activeKeys = Object.keys(COLUMN_DEFINITIONS);
    }

    // 4. Tạo Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sach NCC');

    // Header
    worksheet.columns = activeKeys.map((key) => ({
      header: COLUMN_DEFINITIONS[key].header,
      key: key,
      width: COLUMN_DEFINITIONS[key].width,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' }, // Màu xanh lá cho Supplier
    };

    // 5. Đổ dữ liệu
    suppliers.forEach((supplier) => {
      const rowData: any = {};
      activeKeys.forEach((key) => {
        rowData[key] = COLUMN_DEFINITIONS[key].transform(supplier);
      });
      worksheet.addRow(rowData);
    });

    return await workbook.xlsx.writeBuffer();
  }
  async generateSupplierTemplate() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Mau nhap NCC');

    worksheet.columns = [
      { header: 'Mã NCC (Bỏ trống tự sinh)', key: 'code', width: 20 },
      { header: 'Tên NCC (*)', key: 'name', width: 30 },
      { header: 'Nhóm NCC', key: 'group', width: 20 },
      { header: 'Điện thoại', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      { header: 'Nợ đầu kỳ', key: 'debt', width: 15 },
      { header: 'Ghi chú', key: 'note', width: 20 },
    ];

    // Dòng mẫu
    worksheet.addRow({
      code: '',
      name: 'Công ty TNHH Phụ Tùng A',
      group: 'Lốp xe',
      phone: '0909123456',
      email: 'contact@companyA.com',
      address: '123 QL1A, HCM',
      debt: 0,
      note: 'Nhà cung cấp chiến lược',
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' },
    };

    return await workbook.xlsx.writeBuffer();
  }

  // ====================================================================
  // 6. IMPORT PURCHASE ORDERS (NHẬP HÀNG) - ĐÃ FIX TYPE
  // ====================================================================
  async importPurchaseOrders(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng upload file Excel');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new BadRequestException('File không hợp lệ');

    const results = { total: 0, success: 0, failed: 0, errors: [] as string[] };

    // Cache
    const supplierCache = new Map<string, bigint>();
    const warehouseCache = new Map<string, bigint>();
    const productCache = new Map<string, bigint>();

    // Gom nhóm các dòng theo Mã phiếu nhập
    const ordersMap = new Map<string, any[]>();

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const code = row.getCell(1).text?.trim();
      if (!code) return;

      if (!ordersMap.has(code)) {
        ordersMap.set(code, []);
      }
      ordersMap.get(code)?.push({ row, rowNumber });
    });

    results.total = ordersMap.size;

    // Xử lý từng đơn hàng
    for (const [code, rows] of ordersMap) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Lấy thông tin Header từ dòng đầu tiên
          const firstRowData = rows[0];
          if (!firstRowData) return; // Guard clause
          const firstRow = firstRowData.row;

          // 1. Tìm Nhà cung cấp
          const supplierCode = firstRow.getCell(2).text?.trim();
          let supplierId = supplierCache.get(supplierCode);
          if (!supplierId) {
            const supplier = await tx.partners.findUnique({
              where: { code: supplierCode },
            });
            if (!supplier)
              throw new Error(`Không tìm thấy NCC mã: ${supplierCode}`);
            supplierId = supplier.id;
            supplierCache.set(supplierCode, supplierId);
          }

          // 2. Tìm Kho
          const warehouseName = firstRow.getCell(3).text?.trim();
          let warehouseId = warehouseCache.get(warehouseName);
          if (!warehouseId) {
            const wh = await tx.warehouses.findFirst({
              where: { name: warehouseName },
            });
            if (!wh)
              throw new Error(`Không tìm thấy Kho tên: ${warehouseName}`);
            warehouseId = wh.id;
            warehouseCache.set(warehouseName, warehouseId);
          }

          // 3. Thông tin chung
          const importDateCell = firstRow.getCell(4).value;
          const importDate = importDateCell
            ? new Date(firstRow.getCell(4).text)
            : new Date();
          const note = firstRow.getCell(5).text?.trim();

          // 4. Xử lý danh sách sản phẩm (Items)
          let totalAmount = 0;

          // FIX LỖI 1: Khai báo kiểu dữ liệu rõ ràng cho mảng itemsData
          const itemsData: {
            product_id: bigint;
            quantity: number;
            import_price: number;
          }[] = [];

          for (const item of rows) {
            const r = item.row;
            const sku = r.getCell(6).text?.trim(); // Mã SKU
            const quantity = this.parseNumber(r.getCell(7).value); // Số lượng
            const price = this.parseNumber(r.getCell(8).value); // Giá nhập

            if (!sku || quantity <= 0) continue;

            // FIX LỖI 2: Xử lý undefined cho productId
            let productId: bigint | undefined = productCache.get(sku);

            if (!productId) {
              const product = await tx.products.findUnique({ where: { sku } });
              if (!product)
                throw new Error(`Sản phẩm SKU ${sku} không tồn tại`);
              productId = product.id;
              productCache.set(sku, productId);
            }

            totalAmount += quantity * price;

            // Push vào mảng đã định nghĩa type
            itemsData.push({
              product_id: productId!, // Dấu ! khẳng định productId không null/undefined
              quantity,
              import_price: price,
            });
          }

          if (itemsData.length === 0)
            throw new Error('Phiếu không có sản phẩm hợp lệ');

          // 5. Tạo Phiếu nhập
          await tx.purchase_orders.create({
            data: {
              code,
              supplier_id: supplierId!,
              warehouse_id: warehouseId!,
              import_date: importDate,
              note,
              total_amount: totalAmount,
              final_amount: totalAmount,
              paid_amount: 0,
              status: 'completed',

              purchase_order_items: {
                create: itemsData, // TypeScript giờ sẽ chịu nhận mảng này
              },
            },
          });
        });
        results.success++;
      } catch (error: any) {
        results.failed++;
        // Lấy rowNumber an toàn
        const rowNum = rows[0]?.rowNumber || 'Unknown';
        results.errors.push(`Dòng ~${rowNum} (Mã ${code}): ${error.message}`);
      }
    }

    return results;
  }

  async exportPurchaseOrders(selectedColumns: string[] | null) {
    const orders = await this.prisma.purchase_orders.findMany({
      orderBy: { import_date: 'desc' },
      include: {
        partners: true, // NCC
        warehouses: true, // Kho
        profiles: true, // Nhân viên
      },
    });

    const COLUMN_DEFINITIONS: Record<
      string,
      { header: string; width: number; transform: (p: any) => any }
    > = {
      code: {
        header: 'Mã phiếu',
        width: 20,
        transform: (o) => o.code,
      },
      import_date: {
        header: 'Ngày nhập',
        width: 20,
        transform: (o) =>
          o.import_date
            ? new Date(o.import_date).toLocaleDateString('vi-VN')
            : '',
      },
      supplier_code: {
        header: 'Mã NCC',
        width: 15,
        transform: (o) => o.partners?.code,
      },
      supplier_name: {
        header: 'Nhà cung cấp',
        width: 30,
        transform: (o) => o.partners?.name,
      },
      warehouse: {
        header: 'Kho nhập',
        width: 20,
        transform: (o) => o.warehouses?.name,
      },
      staff: {
        header: 'Người nhập',
        width: 20,
        transform: (o) => o.profiles?.full_name,
      },
      total_amount: {
        header: 'Tổng tiền',
        width: 15,
        transform: (o) => Number(o.total_amount),
      },
      discount: {
        header: 'Giảm giá',
        width: 15,
        transform: (o) => Number(o.discount),
      },
      final_amount: {
        header: 'Cần trả NCC',
        width: 15,
        transform: (o) => Number(o.final_amount),
      },
      paid_amount: {
        header: 'Đã trả',
        width: 15,
        transform: (o) => Number(o.paid_amount),
      },
      debt: {
        header: 'Còn nợ',
        width: 15,
        transform: (o) => Number(o.final_amount) - Number(o.paid_amount),
      },
      status: {
        header: 'Trạng thái',
        width: 15,
        transform: (o) => {
          if (o.status === 'completed') return 'Đã nhập hàng';
          if (o.status === 'draft') return 'Phiếu tạm';
          return 'Đã hủy';
        },
      },
      note: {
        header: 'Ghi chú',
        width: 30,
        transform: (o) => o.note,
      },
    };

    // Filter columns
    let activeKeys: string[] = [];
    if (selectedColumns && selectedColumns.length > 0) {
      activeKeys = selectedColumns.filter((key) => COLUMN_DEFINITIONS[key]);
    } else {
      activeKeys = Object.keys(COLUMN_DEFINITIONS);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sach phieu nhap');

    worksheet.columns = activeKeys.map((key) => ({
      header: COLUMN_DEFINITIONS[key].header,
      key: key,
      width: COLUMN_DEFINITIONS[key].width,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' }, // Màu xanh dương
    };

    orders.forEach((order) => {
      const rowData: any = {};
      activeKeys.forEach((key) => {
        rowData[key] = COLUMN_DEFINITIONS[key].transform(order);
      });
      worksheet.addRow(rowData);
    });

    return await workbook.xlsx.writeBuffer();
  }
}
