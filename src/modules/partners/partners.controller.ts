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
} from '@nestjs/swagger';
import { SupabaseGuard } from 'src/auth/supabase.guard';

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
  @Get(':id')
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
}
