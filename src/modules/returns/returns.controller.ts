import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';

@ApiTags('Returns')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  @Post()
  create(@Body() dto: CreateReturnDto) {
    return this.service.create(dto);
  }

  // @Get()
  // findAll() {
  //   return this.service.findAll();
  // }
}
