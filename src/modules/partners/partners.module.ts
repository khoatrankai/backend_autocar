import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { AuthModule } from 'src/auth/auth.module';
// PrismaModule phải là Global, nếu không thì phải import vào đây
// import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule], // Uncomment nếu PrismaModule không @Global()
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService], // Export nếu module khác (như Orders) cần dùng logic check partner
})
export class PartnersModule {}
