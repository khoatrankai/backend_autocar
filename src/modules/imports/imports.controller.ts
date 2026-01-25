import {
  Controller,
  Post,
  Get,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
// import { Response } from 'express';
import { ImportsService } from './imports.service';

// --- BẢO MẬT & PHÂN QUYỀN ---
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/dto/auth.dto';
import { SupabaseGuard } from 'src/auth/supabase.guard';
import type { Response } from 'express';

@ApiTags('Import Data')
@Controller('import')
@UseGuards(SupabaseGuard, RolesGuard) // Bảo vệ toàn bộ Controller
@ApiBearerAuth()
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  // ====================================================================
  // 1. IMPORT EXCEL (POST)
  // ====================================================================
  @Post('products')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE) // Chỉ Admin và Thủ kho được nhập
  @ApiOperation({ summary: 'Import Sản phẩm từ file Excel (.xlsx)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel nhập liệu (theo mẫu)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.service.importProducts(file);
  }

  // ====================================================================
  // 2. TẢI FILE MẪU TRỐNG (GET)
  // ====================================================================
  @Get('products/template')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Tải file mẫu Excel chuẩn để nhập liệu mới' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.service.generateProductTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=mau_nhap_san_pham.xlsx',
      'Content-Length': (buffer as any).length,
    });

    res.send(buffer);
  }

  // ====================================================================
  // 3. XUẤT DỮ LIỆU RA EXCEL (GET)
  // ====================================================================
  @Get('products/export')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Xuất sản phẩm ra Excel với các cột tùy chọn' })
  async exportData(
    @Res() res: Response,
    @Query('columns') columns?: string, // Nhận chuỗi các cột: "sku,name,price..."
  ) {
    // Chuyển chuỗi query thành mảng. Nếu không chọn gì thì mặc định null để service xử lý (xuất hết hoặc lỗi)
    const selectedColumns = columns ? columns.split(',') : null;

    const buffer = await this.service.exportProducts(selectedColumns);

    const fileName = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Length': (buffer as any).length,
    });

    res.send(buffer);
  }

  @Get('suppliers/export')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Xuất danh sách NCC ra Excel với các cột tùy chọn' })
  async exportSuppliers(
    @Res() res: Response,
    @Query('columns') columns?: string, // Nhận chuỗi "code,name,phone..."
  ) {
    const selectedColumns = columns ? columns.split(',') : null;
    const buffer = await this.service.exportSuppliers(selectedColumns);

    const fileName = `suppliers_export_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Length': (buffer as any).length,
    });

    res.send(buffer);
  }

  @Post('suppliers')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE) // Chỉ Admin và Thủ kho được nhập
  @ApiOperation({ summary: 'Import NCC từ file Excel (.xlsx)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel nhập liệu (theo mẫu)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFileSupplier(@UploadedFile() file: Express.Multer.File) {
    return this.service.importSuppliers(file);
  }

  @Get('suppliers/template')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Tải file mẫu Excel chuẩn để nhập liệu mới' })
  async downloadTemplateSuppliers(@Res() res: Response) {
    const buffer = await this.service.generateSupplierTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=mau_nhap_ncc.xlsx',
      'Content-Length': (buffer as any).length,
    });

    res.send(buffer);
  }

  // ====================================================================
  // 1. IMPORT PHIẾU NHẬP HÀNG TỪ EXCEL
  // ====================================================================
  @Post('purchase-orders')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE) // Chỉ Admin và Thủ kho được nhập
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import Phiếu nhập hàng từ Excel',
    description:
      'File Excel cần có các cột: Mã phiếu, Mã NCC, Tên Kho, Ngày nhập, Ghi chú, Mã SKU, Số lượng, Giá nhập',
  })
  importPurchaseOrders(@UploadedFile() file: Express.Multer.File) {
    return this.service.importPurchaseOrders(file);
  }

  // ====================================================================
  // 2. XUẤT DANH SÁCH PHIẾU NHẬP RA EXCEL
  // ====================================================================
  @Get('purchase-orders/export')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({
    summary: 'Xuất danh sách phiếu nhập ra Excel (Chọn cột tùy chỉnh)',
  })
  async exportPurchaseOrders(
    @Res() res: Response,
    @Query('columns') columns?: string, // Nhận chuỗi: "code,supplier_name,total_amount..."
  ) {
    const selectedColumns = columns ? columns.split(',') : null;
    const buffer = await this.service.exportPurchaseOrders(selectedColumns);

    const fileName = `phieu_nhap_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Length': (buffer as any).length,
    });

    res.send(buffer);
  }
}
