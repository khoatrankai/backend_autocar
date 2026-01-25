import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { SharedModule } from 'src/shared/shared.module'; // Import cái này!
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule], // <-- QUAN TRỌNG: Phải có dòng này mới dùng được DB
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
