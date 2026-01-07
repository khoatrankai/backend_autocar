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
  async exportProducts() {
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sach hang hoa');

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

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' },
    };

    products.forEach((p) => {
      let categoryString = '';
      if (p.categories) {
        const catLvl1 = p.categories;
        const catLvl2 = catLvl1.categories;
        const catLvl3 = catLvl2?.categories;

        if (catLvl3) {
          categoryString = `${catLvl3.name}>>${catLvl2.name}>>${catLvl1.name}`;
        } else if (catLvl2) {
          categoryString = `${catLvl2.name}>>${catLvl1.name}`;
        } else {
          categoryString = catLvl1.name;
        }
      }

      let carString = '';
      const compatibility = p.product_compatibility || [];
      if (compatibility.length > 0) {
        const car = compatibility[0];
        const year = car.year_end
          ? `${car.year_start}-${car.year_end}`
          : `${car.year_start || ''}`;
        carString = `${car.car_make} ${car.car_model} ${year}`.trim();
      }

      const totalQuantity =
        p.inventory?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

      worksheet.addRow({
        type: 'Hàng hóa',
        category: categoryString,
        sku: p.sku,
        name: p.name,
        brand: carString,
        retail_price: Number(p.retail_price),
        cost_price: Number(p.cost_price),
        quantity: totalQuantity,
        customer_order: 0,
        expected: '0 ngày',
        min_stock: p.min_stock_alert || 0,
        max_stock: 999999,
        unit: p.unit,
        unit_code: '',
        exchange: 1,
        image: p.image_url || '',
        weight: '',
        active: 1,
        direct_sell: 1,
        desc: '',
      });
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
}
