import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module'; // Import cái này!
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [SharedModule], // <-- QUAN TRỌNG: Phải có dòng này mới dùng được DB
  controllers: [WarehousesController],
  providers: [WarehousesService],
})
export class WarehousesModule {}
