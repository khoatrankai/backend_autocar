import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module'; // Import cái này!
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [SharedModule], // <-- QUAN TRỌNG: Phải có dòng này mới dùng được DB
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
