/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { ProductsModule } from './modules/products/products.module';
import { SupabaseService } from './supabase/supabase.service';
import { UploadController } from './upload/upload.controller';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PartnersModule } from './modules/partners/partners.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
// import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ImportsModule } from './modules/imports/imports.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { UsersModule } from './modules/users/users.module';
import { StockTransfersModule } from './modules/stock-transfers/stock-transfers.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
// Sau này bạn sẽ import thêm AuthModule, ProductsModule vào đây

@Module({
  imports: [
    // 1. Cấu hình đọc file .env
    ConfigModule.forRoot({
      isGlobal: true, // Để dùng biến môi trường ở mọi nơi
    }),

    // 2. Load module kết nối Database
    // eslint-disable-next-line prettier/prettier
    SharedModule,
    CategoriesModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    PartnersModule,
    WarehousesModule,
    ImportsModule,
    TransactionsModule,
    ReturnsModule,
    ReportsModule,
    InventoryModule,
    ScheduleModule.forRoot(),
    TasksModule,
    PurchaseOrdersModule,
    UsersModule,
    StockTransfersModule,
    ProfilesModule,
  ],
  controllers: [AppController, UploadController],
  providers: [AppService, SupabaseService],
})
export class AppModule {}
