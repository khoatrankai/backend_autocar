import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CheckInventoryDto } from './dto/check-inventory.dto';

@ApiTags('Inventory (Quản lý tồn kho)')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('check')
  @ApiOperation({
    summary: 'Kiểm tra tồn kho sản phẩm theo kho',
    description:
      'Trả về tổng tồn kho và chi tiết số lượng tại từng kho để Sale tư vấn điều hàng.',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin tồn kho',
    schema: {
      example: {
        product_id: 1,
        total_stock: 100,
        details: [
          { warehouse_id: 1, name: 'Kho Tổng', quantity: 80 },
          { warehouse_id: 2, name: 'CN Quận 7', quantity: 20 },
        ],
      },
    },
  })
  checkInventory(@Query() query: CheckInventoryDto) {
    return this.inventoryService.checkStock(query);
  }
}
