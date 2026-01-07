import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  @Get('daily-sales')
  @ApiOperation({ summary: 'Báo cáo doanh thu theo ngày' })
  async getDailySales() {
    // Lấy 30 ngày gần nhất
    return this.prisma.daily_sales_reports.findMany({
      orderBy: { report_date: 'desc' },
      take: 30,
    });
  }

  @Get('staff-sales')
  @ApiOperation({ summary: 'Báo cáo doanh số nhân viên' })
  async getStaffSales(@Query('month') month: string) {
    // month format: '2024-01'
    return this.prisma.staff_sales_reports.findMany({
      where: { report_month: month },
      orderBy: { total_revenue: 'desc' },
    });
  }

  @Get('logs')
  @ApiOperation({ summary: 'Nhật ký hoạt động (Audit Logs)' })
  async getLogs() {
    return this.prisma.activity_logs.findMany({
      take: 50,
      orderBy: { created_at: 'desc' },
    });
  }
}
