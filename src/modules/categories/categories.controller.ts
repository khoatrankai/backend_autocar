import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
// import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from 'src/auth/dto/auth.dto';
import { SupabaseGuard } from 'src/auth/supabase.guard';
@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  @ApiBearerAuth() // <--- Hiện ổ khóa trên Swagger
  @UseGuards(SupabaseGuard, RolesGuard) // Chạy AuthGuard trước để lấy user, rồi chạy RolesGuard
  @Roles(UserRole.ADMIN) // <--- Chỉ định: Phải là ADMIN mới được vào
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
