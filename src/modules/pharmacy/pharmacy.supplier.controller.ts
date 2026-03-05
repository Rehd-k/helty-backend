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
import { PharmacySupplierService } from './pharmacy.supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { ListSupplierDto } from './dto/list-supplier.dto';

@ApiTags('Pharmacy - Suppliers')
@Controller('pharmacy/suppliers')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacySupplierController {
  constructor(private readonly service: PharmacySupplierService) {}

  @Post()
  @ApiOperation({ summary: 'Create a supplier' })
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List suppliers with filtering and pagination' })
  findAll(@Query() query: ListSupplierDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a supplier (fails if batches/POs linked)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
