import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Global() // Quan trọng: Giúp dùng Prisma ở mọi nơi mà không cần import lại
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedModule {}
