import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import {
  CreatePartnerDto,
  QuickCreatePartnerDto,
  AssignPartnerDto,
  UpdatePartnerStatusDto,
} from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { FilterPartnerDto } from './dto/filter-partner.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SupabaseGuard } from 'src/auth/supabase.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilterSupplierDto } from './dto/filter-supplier.dto';

// Giả định bạn có AuthGuard và RolesGuard
// import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
// import { RolesGuard } from 'src/common/guards/roles.guard';
// import { Roles } from 'src/common/decorators/roles.decorator';
// import { CurrentUser } from 'src/common/decorators/current-user.decorator';

// Interface user mock (Thay thế bằng interface thật của bạn)
interface UserPayload {
  id: string;
  role: 'admin' | 'accountant' | 'sale' | 'warehouse';
}

@ApiTags('Partners (Khách hàng & NCC)')
@Controller('partners')
// @UseGuards(JwtAuthGuard, RolesGuard) // Bật Guard bảo vệ toàn bộ Controller
// @ApiBearerAuth()
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  // -------------------------------------------------------
  // 1. Lấy danh sách (Có phân quyền)
  // -------------------------------------------------------

  @Get()
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({
    summary: 'Lấy danh sách khách hàng (Có phân trang & phân quyền)',
  })
  findAll(
    @Query() filter: FilterPartnerDto,
    @Req() req,
    // @CurrentUser() user: UserPayload, // Lấy user từ token
  ) {
    // MOCK USER để test (Xóa khi tích hợp Auth thật)
    const mockUser: UserPayload = req.user;

    return this.partnersService.findAll(filter, mockUser);
  }

  @Get('groups')
  @ApiOperation({
    summary: 'Lấy danh sách nhóm nhà cung cấp (distinct group_name)',
  })
  getGroups() {
    return this.partnersService.getPartnerGroups();
  }

  @Get('supplier')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({
    summary: 'Lấy danh sách nhà cung cấp (Có phân trang & phân quyền)',
  })
  findAllSupplier(
    @Query() filter: FilterSupplierDto,
    // @CurrentUser() user: UserPayload, // Lấy user từ token
  ) {
    // MOCK USER để test (Xóa khi tích hợp Auth thật)

    return this.partnersService.findAllSupplier(filter);
  }

  // -------------------------------------------------------
  // 2. Tạo nhanh (Quick Create)
  // -------------------------------------------------------
  @Post('quick')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({ summary: 'Tạo nhanh khách hàng (Dành cho Sales)' })
  createQuick(
    @Body() dto: QuickCreatePartnerDto,
    @Req() req,
    // @CurrentUser() user: UserPayload,
  ) {
    // MOCK USER
    const mockUser: UserPayload = req.user;

    return this.partnersService.createQuick(dto, mockUser);
  }

  // -------------------------------------------------------
  // Tạo đầy đủ (Standard Create)
  // -------------------------------------------------------
  @Post()
  @ApiOperation({ summary: 'Tạo mới đối tác với đầy đủ thông tin' })
  create(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.create(createPartnerDto);
  }

  // -------------------------------------------------------
  // 3. Phân bổ khách hàng (Admin only)
  // -------------------------------------------------------
  @Patch(':id/assign')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({ summary: 'Phân bổ nhân viên phụ trách (Chỉ Admin)' })
  assignStaff(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPartnerDto,
    @Req() req,
    // @CurrentUser() user: UserPayload,
  ) {
    // MOCK USER (Giả sử là admin)
    const mockAdmin: UserPayload = req.user;

    return this.partnersService.assignStaff(id, dto.staff_id, mockAdmin);
  }

  // -------------------------------------------------------
  // 4. Khóa/Mở khóa khách hàng (Admin only)
  // -------------------------------------------------------
  @Patch(':id/status')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({ summary: 'Khóa hoặc Mở khóa khách hàng (Chỉ Admin)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartnerStatusDto,
    @Req() req,
    // @CurrentUser() user: UserPayload,
  ) {
    // MOCK USER
    const mockAdmin: UserPayload = req.user;

    return this.partnersService.updateStatus(id, dto.status, mockAdmin);
  }

  // -------------------------------------------------------
  // Xem chi tiết
  // -------------------------------------------------------
  @Get('id/:id')
  @ApiOperation({ summary: 'Xem chi tiết đối tác' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.partnersService.findOne(id);
  }

  // -------------------------------------------------------
  // Cập nhật thông tin
  // -------------------------------------------------------
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin đối tác' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ) {
    return this.partnersService.update(id, updatePartnerDto);
  }

  // -------------------------------------------------------
  // Xóa (Soft delete)
  // -------------------------------------------------------
  @Delete(':id')
  // @Roles('admin') // Bật cái này nếu dùng Guard thật
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({
    summary: 'Xóa đối tác (Chuyển trạng thái sang Locked - Chỉ Admin)',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    // @CurrentUser() user: UserPayload,
  ) {
    // MOCK USER: Giả lập là Admin để test được
    const mockAdmin: UserPayload = req.user;

    // Nếu muốn test lỗi Forbidden, hãy thử đổi role thành 'sale'
    // const mockSale: UserPayload = { id: 'sale-id', role: 'sale' };

    return this.partnersService.remove(id, mockAdmin);
  }

  @Post('import')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({ summary: 'Import đối tác từ file Excel (.xlsx)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importExcel(
    @UploadedFile()
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.partnersService.importExcel(file, req.user);
  }

  // ==========================================
  // 4. EXPORT EXCEL
  // ==========================================
  @Get('export')
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({ summary: 'Xuất danh sách ra Excel (Theo bộ lọc hiện tại)' })
  async exportExcel(
    @Query() filter: FilterPartnerDto,
    @Req() req: any,
    @Res() res: any,
  ) {
    // 1. Gọi service để lấy Buffer file
    const buffer = await this.partnersService.exportExcel(filter, req.user);

    // 2. Set Header để trình duyệt hiểu là file tải về
    const fileName = `DanhSachDoiTac_${Date.now()}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.byteLength,
    });

    // 3. Gửi buffer về client
    res.send(buffer);
  }
}
