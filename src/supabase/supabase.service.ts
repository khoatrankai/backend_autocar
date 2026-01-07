import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient; // <--- 1. Thêm biến này

  constructor(private configService: ConfigService) {
    // Client thường (dùng cho Login/Get Data)
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL') as string,
      this.configService.get<string>('SUPABASE_KEY') as string,
    );

    // Client Admin (dùng cho Register để bypass email)
    const adminKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (adminKey) {
      this.supabaseAdmin = createClient(
        this.configService.get<string>('SUPABASE_URL') as string,
        adminKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );
    }
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // <--- 2. Thêm hàm này để lấy quyền Admin
  getAdminClient(): SupabaseClient {
    if (!this.supabaseAdmin) {
      throw new Error(
        'Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trong file .env',
      );
    }
    return this.supabaseAdmin;
  }
}
