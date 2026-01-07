import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseGuard } from './supabase.guard';
import { SupabaseService } from 'src/supabase/supabase.service';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseService,
    SupabaseGuard, // Để dùng cho các module khác muốn bảo vệ API
  ],
  exports: [AuthService, SupabaseGuard, SupabaseService],
})
export class AuthModule {}
