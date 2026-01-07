import { Module } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { SharedModule } from 'src/shared/shared.module'; // Import để dùng PrismaService
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
