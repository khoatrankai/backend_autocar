import { Module } from '@nestjs/common';
import { StockTransfersService } from './stock-transfers.service';
import { StockTransfersController } from './stock-transfers.controller';
import { SharedModule } from 'src/shared/shared.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [StockTransfersController],
  providers: [StockTransfersService],
  exports: [StockTransfersService], // Export nếu module khác cần dùng service này
})
export class StockTransfersModule {}
