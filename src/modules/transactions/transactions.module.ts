import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module'; // Import cái này!
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [SharedModule], // <-- QUAN TRỌNG: Phải có dòng này mới dùng được DB
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
