import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseGuard } from '../auth/supabase.guard';
// 1. Import thêm thư viện Swagger
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiTags } from '@nestjs/swagger';

@ApiTags('Upload') // Gom nhóm API trong Swagger
@Controller('upload')
export class UploadController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('image')
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth() // <--- 2. Báo cho Swagger biết API này cần ổ khóa (Token)
  @ApiConsumes('multipart/form-data') // <--- 3. Báo Swagger đây là form upload file
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          // Tên field này phải khớp với FileInterceptor('file') bên dưới
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');

    // Logic cũ giữ nguyên...
    const fileName = `phu-tung-${Date.now()}-${file.originalname}`;

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .storage.from('phu-tung')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const { data: publicUrlData } = this.supabaseService
      .getClient()
      .storage.from('phu-tung')
      .getPublicUrl(fileName);

    return {
      message: 'Upload successful',
      url: publicUrlData.publicUrl,
      path: data.path,
    };
  }
}
