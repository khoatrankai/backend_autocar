import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { SharedModule } from 'src/shared/shared.module'; // Import cái này!
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule], // <-- QUAN TRỌNG: Phải có dòng này mới dùng được DB
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService], // Export nếu module Orders cần gọi check tồn kho
})
export class InventoryModule {}
