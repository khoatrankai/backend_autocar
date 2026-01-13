import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './core/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Validation (Kiểm tra dữ liệu đầu vào)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // <--- QUAN TRỌNG: Tự động convert kiểu dữ liệu
      whitelist: true, // Tự động bỏ các trường không có trong DTO
      forbidNonWhitelisted: true, // Báo lỗi nếu gửi trường thừa
      // transformOptions: {
      //   enableImplicitConversion: true, // (Tùy chọn) Convert ngầm định không cần @Type
      // },
    }),
  );
  (BigInt.prototype as any).toJSON = function () {
    const int = Number.parseInt(this.toString());
    // Nếu số nhỏ nằm trong giới hạn Javascript thì trả về Number, nếu quá lớn thì trả về String
    return Number.isSafeInteger(int) ? int : this.toString();
  };
  // 2. Bật CORS (Để Frontend gọi được API)
  app.enableCors();
  app.useGlobalInterceptors(new TransformInterceptor(new Reflector()));
  // 3. Cấu hình Swagger API Docs
  const config = new DocumentBuilder()
    .setTitle('AutoCar API')
    .setDescription('API Hệ thống quản lý phụ tùng ô tô')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger is running on: ${await app.getUrl()}/api`);
}
bootstrap();
