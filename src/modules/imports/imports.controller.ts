import {
  Controller,
  Post,
  Get,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
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
  @ApiOperation({
    summary: 'Xuất toàn bộ sản phẩm ra Excel (Có thể sửa rồi Import lại)',
  })
  async exportData(@Res() res: Response) {
    const buffer = await this.service.exportProducts();

    // Tạo tên file kèm ngày giờ hiện tại: products_export_2026-01-05.xlsx
    const fileName = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Length': (buffer as any).length,
    });

    res.send(buffer);
  }
}
