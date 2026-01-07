import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

// Auth Guards
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/dto/auth.dto';
import { SupabaseGuard } from 'src/auth/supabase.guard';

@ApiTags('Products')
@Controller('products')
@UseGuards(SupabaseGuard, RolesGuard) // Bảo vệ toàn bộ Controller
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // 1. Tạo sản phẩm (Chỉ Admin hoặc Kho)
  @Post()
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Tạo sản phẩm mới (Kèm tồn kho & Xe tương thích)' })
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  // 2. Lấy danh sách (Ai cũng xem được, miễn là đã login)
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm (Phân trang & Tìm kiếm)' })
  findAll(@Query() query: FilterProductDto) {
    return this.service.findAll(query);
  }

  // 3. Xem chi tiết
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết sản phẩm' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // 4. Cập nhật (Chỉ Admin hoặc Kho)
  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Cập nhật thông tin sản phẩm' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }
}
