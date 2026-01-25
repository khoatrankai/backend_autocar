import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from 'src/auth/auth.module';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export nếu các module khác (như Auth) cần dùng
})
export class UsersModule {}
