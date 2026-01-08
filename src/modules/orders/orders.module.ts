import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module'; // Import cái này!
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule], // <-- QUAN TRỌNG: Phải có dòng này mới dùng được DB
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
