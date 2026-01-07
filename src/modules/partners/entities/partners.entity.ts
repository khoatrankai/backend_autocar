import { ApiProperty } from '@nestjs/swagger';
import { PartnerStatus, PartnerType } from 'src/common/enums';

export class PartnerEntity {
  @ApiProperty({ example: 1, description: 'ID dạng số (BigInt converted)' })
  id: number;

  @ApiProperty({ example: 'KH001' })
  code: string;

  @ApiProperty({ example: 'Gara Ô tô Tuấn Phát' })
  name: string;

  @ApiProperty({ example: '0912345678', nullable: true, required: false })
  phone: string | null;

  @ApiProperty({
    example: 'tuanphat@gara.com',
    nullable: true,
    required: false,
  })
  email: string | null;

  @ApiProperty({
    example: '123 Phạm Văn Đồng, HN',
    nullable: true,
    required: false,
  })
  address: string | null;

  @ApiProperty({ enum: PartnerType, example: PartnerType.CUSTOMER })
  type: PartnerType;

  @ApiProperty({ example: 'Khách Vip', nullable: true, required: false })
  groupName: string | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  assignedStaffId: string | null;

  @ApiProperty({ enum: PartnerStatus, example: PartnerStatus.ACTIVE })
  status: PartnerStatus;

  @ApiProperty({ example: 5000000, description: 'Nợ hiện tại' })
  currentDebt: number;

  @ApiProperty({ example: 150000000, description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ example: 20000000, description: 'Hạn mức nợ' })
  debtLimit: number;

  @ApiProperty({
    example: 'Khách khó tính, cần gọi trước',
    nullable: true,
    required: false,
  })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;
}
