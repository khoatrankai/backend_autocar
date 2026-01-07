import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTransactionDto) {
    // Trigger SQL sẽ tự động trừ nợ cho partner nếu có partner_id
    return this.prisma.transactions.create({
      data: {
        code: dto.code,
        type: dto.type,
        amount: dto.amount,
        payment_method: dto.payment_method,
        category_id: BigInt(dto.category_id),
        partner_id: dto.partner_id ? BigInt(dto.partner_id) : null,
        order_id: dto.order_id ? BigInt(dto.order_id) : null,
        staff_id: dto.staff_id,
        note: dto.note,
      },
    });
  }

  findAll() {
    return this.prisma.transactions.findMany({
      include: {
        transaction_categories: true,
        partners: { select: { name: true } },
        profiles: { select: { full_name: true } },
      },
      orderBy: { transaction_date: 'desc' },
    });
  }
}
