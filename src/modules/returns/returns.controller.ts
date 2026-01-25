import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { FilterReturnDto } from './dto/filter-return.dto';

@ApiTags('Returns')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  @Post()
  create(@Body() dto: CreateReturnDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: FilterReturnDto) {
    return this.service.findAll(query);
  }
  // @Get()
  // findAll() {
  //   return this.service.findAll();
  // }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReturnDto: any) {
    return this.service.update(id, updateReturnDto);
  }

  @Delete('bulk') // Đặt trước :id để không bị nhầm route
  removeMany(@Body('ids') ids: string[]) {
    return this.service.removeMany(ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
