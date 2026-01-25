import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductsService } from 'src/modules/products/products.service';

@Injectable()
export class TasksService {
  // Tạo logger để theo dõi log trong console
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly productsService: ProductsService) {}

  // ========================================================
  // Cấu hình chạy lúc 2:00 sáng hàng ngày
  // Ký hiệu: '0 2 * * *' (Giây - Phút - Giờ - Ngày - Tháng - Thứ)
  // ========================================================
  @Cron('0 2 * * *', {
    name: 'calculate_daily_sales',
    timeZone: 'Asia/Ho_Chi_Minh', // Quan trọng: Set múi giờ Việt Nam
  })
  async handleCalculateSalesMetrics() {
    this.logger.log('Bắt đầu Cronjob: Tính toán tốc độ bán hàng...');

    try {
      // Gọi hàm executeRaw mà bạn đã viết trong ProductsService
      await this.productsService.updateSalesMetrics();

      this.logger.log('Hoàn thành Cronjob: Đã cập nhật xong dữ liệu.');
    } catch (error) {
      this.logger.error('Lỗi Cronjob:', error);
    }
  }
}
