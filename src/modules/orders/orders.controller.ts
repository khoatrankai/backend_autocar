import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  // Req, // Dùng cái này nếu có Auth thật
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseGuard } from 'src/auth/supabase.guard';

// Giả sử bạn có AuthGuard
// import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
// import { CurrentUser } from 'src/common/decorators/current-user.decorator';

interface UserPayload {
  id: string;
  role: string;
}

@ApiTags('Orders (Đơn hàng)')
@Controller('orders')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // -------------------------------------------------------
  // 1. Tạo đơn hàng (Logic phức tạp: Check nợ, Check kho, Transaction)
  // -------------------------------------------------------

  @Get('stock-card/:productId')
  async getStockCard(@Param('productId') productId: string) {
    return this.ordersService.getProductStockCard(productId);
  }

  @Post()
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard) // <--- Kích hoạt bảo vệ
  @ApiOperation({ summary: 'Tạo đơn hàng mới (Bán hàng)' })
  create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req,
    // @CurrentUser() user: UserPayload, // Lấy user từ Token
  ) {
    // --- MOCK USER ID (Xóa khi dùng Auth thật) ---
    // Giả sử nhân viên đang login có ID này
    const currentUserId = req?.user?.id;
    // Nếu trong DTO có gửi staff_id (Admin tạo hộ), Service đã ưu tiên lấy staff_id trong DTO

    return this.ordersService.create(createOrderDto, currentUserId);
  }

  // -------------------------------------------------------
  // 2. Lấy danh sách đơn hàng
  // -------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đơn hàng' })
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy đơn hàng' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
