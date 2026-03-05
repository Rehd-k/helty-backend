import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PharmacyConsumableService } from './pharmacy.consumable.service';
import { CreateConsumableDto, UpdateConsumableDto } from './dto/consumable.dto';
import { ListConsumableDto } from './dto/list-consumable.dto';

@ApiTags('Pharmacy - Consumables')
@Controller('pharmacy/consumables')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyConsumableController {
  constructor(private readonly service: PharmacyConsumableService) {}

  @Post()
  @ApiOperation({ summary: 'Create a consumable' })
  create(@Body() dto: CreateConsumableDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List consumables with filtering and pagination' })
  findAll(@Query() query: ListConsumableDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consumable by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a consumable' })
  update(@Param('id') id: string, @Body() dto: UpdateConsumableDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a consumable' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
