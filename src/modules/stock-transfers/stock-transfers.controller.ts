import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { StockTransfersService } from './stock-transfers.service';
import {
  CreateTransferDto,
  RejectTransferDto,
} from './dto/create-transfer.dto';
import {
  FilterTransferAdvanceDto,
  FilterTransferDto,
} from './dto/filter-transfer.dto';

// Giả sử bạn có AuthGuard, nếu không thì bỏ @UseGuards
// import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('stock-transfers')
// @UseGuards(JwtAuthGuard)
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  // ==========================================
  // 1. TẠO PHIẾU CHUYỂN (Kho đi tạo phiếu)
  // API: POST /stock-transfers
  // ==========================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDto: CreateTransferDto, @Req() req: any) {
    // Lấy ID nhân viên đang đăng nhập (từ token)
    // Nếu chưa có auth thì truyền cứng test: const userId = 'uuid-string'
    const userId = req.user?.id || 'staff-uuid-placeholder';
    return this.stockTransfersService.create(createDto, userId);
  }

  @Get('advance')
  findAllAdvanced(@Query() query: FilterTransferAdvanceDto) {
    return this.stockTransfersService.findAllAdvanced(query);
  }

  // ==========================================
  // 2. LẤY DANH SÁCH (Màn hình lưới dữ liệu)
  // API: GET /stock-transfers?from_warehouse=1&status=pending
  // ==========================================
  @Get()
  findAll(@Query() query: FilterTransferDto) {
    return this.stockTransfersService.findAll(query);
  }

  // ==========================================
  // 3. XEM CHI TIẾT PHIẾU
  // API: GET /stock-transfers/:id
  // Dùng để hiển thị popup kiểm hàng trước khi nhận
  // ==========================================
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockTransfersService.findOne(+id);
  }

  // ==========================================
  // 4. NHẬN HÀNG (Kho nhận xác nhận đủ)
  // API: POST /stock-transfers/:id/receive
  // Logic: Nhận nguyên phiếu, cộng tồn kho đến, tính lại giá vốn
  // ==========================================
  @Post(':id/receive')
  receive(@Param('id') id: string) {
    // Vì DB không lưu chi tiết thực nhận, endpoint này
    // ngầm hiểu là nhận ĐỦ số lượng như phiếu gửi.
    return this.stockTransfersService.receive(+id);
  }

  // ==========================================
  // 5. TỪ CHỐI PHIẾU (Nếu thiếu/hư hỏng)
  // API: POST /stock-transfers/:id/reject
  // Body: { "reason": "Hàng vỡ hỏng..." }
  // Logic: Hủy phiếu, trả tồn kho về kho gửi
  // ==========================================
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectTransferDto) {
    return this.stockTransfersService.reject(+id, dto.reason);
  }
}
