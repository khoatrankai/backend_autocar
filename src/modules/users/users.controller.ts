import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseGuard } from 'src/auth/supabase.guard';

@ApiTags('Users & Staffs')
@Controller('users')
@UseGuards(SupabaseGuard) // Bảo vệ toàn bộ controller
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // Endpoint: GET /users/staffs
  @Get('staffs')
  @ApiOperation({ summary: 'Lấy danh sách nhân viên (Profiles)' })
  async getStaffs() {
    return await this.service.findAllStaffs();
  }
}
