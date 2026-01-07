import { Injectable } from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateWarehouseDto) {
    return this.prisma.warehouses.create({ data: dto });
  }

  findAll() {
    return this.prisma.warehouses.findMany();
  }

  findOne(id: number) {
    return this.prisma.warehouses.findUnique({ where: { id: BigInt(id) } });
  }
}
