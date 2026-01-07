import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCategoryDto) {
    return this.prisma.categories.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        parent_id: dto.parent_id ? BigInt(dto.parent_id) : null,
      },
    });
  }

  findAll() {
    // Lấy kèm danh mục con (children)
    return this.prisma.categories.findMany({
      include: { other_categories: true },
    });
  }
}
