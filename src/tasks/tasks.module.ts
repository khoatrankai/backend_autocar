import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ProductsModule } from 'src/modules/products/products.module';

@Module({
  imports: [ProductsModule], // Import module chứa ProductsService
  providers: [TasksService],
})
export class TasksModule {}
