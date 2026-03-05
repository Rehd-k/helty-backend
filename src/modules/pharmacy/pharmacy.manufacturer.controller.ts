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
import { PharmacyManufacturerService } from './pharmacy.manufacturer.service';
import { CreateManufacturerDto, UpdateManufacturerDto } from './dto/manufacturer.dto';
import { ListManufacturerDto } from './dto/list-manufacturer.dto';

@ApiTags('Pharmacy - Manufacturers')
@Controller('pharmacy/manufacturers')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyManufacturerController {
  constructor(private readonly service: PharmacyManufacturerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a manufacturer' })
  create(@Body() dto: CreateManufacturerDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List manufacturers with filtering and pagination' })
  findAll(@Query() query: ListManufacturerDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get manufacturer by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a manufacturer' })
  update(@Param('id') id: string, @Body() dto: UpdateManufacturerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a manufacturer (fails if drugs are linked)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
