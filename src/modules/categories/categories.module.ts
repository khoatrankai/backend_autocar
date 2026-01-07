import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module'; // Import cái này!
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule], // <-- QUAN TRỌNG: Phải có dòng này mới dùng được DB
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
