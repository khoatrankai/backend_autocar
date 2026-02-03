import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseGuard } from 'src/auth/supabase.guard';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles')
@Controller('profiles')
@UseGuards(SupabaseGuard) // Bảo vệ toàn bộ controller
@ApiBearerAuth()
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}

  // Endpoint: GET /users/staffs
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhân viên Sale' })
  async getSales(@Query('role') role: string) {
    return await this.service.findAllSales(role);
  }
}
