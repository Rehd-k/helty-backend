import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PharmacyLocationService } from './pharmacy.location.service';
import {
  CreatePharmacyLocationDto,
  UpdatePharmacyLocationDto,
} from './dto/pharmacy-location.dto';
import { ListPharmacyLocationDto } from './dto/list-pharmacy-location.dto';

@ApiTags('Pharmacy - Locations')
@Controller('pharmacy/locations')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyLocationController {
  constructor(private readonly service: PharmacyLocationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a pharmacy location' })
  create(@Body() dto: CreatePharmacyLocationDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({
    summary: 'List pharmacy locations with filtering and pagination',
  })
  findAll(@Query() query: ListPharmacyLocationDto) {
    return this.service.findAll(query);
  }

  @Get('drug/:drugId/quantity')
  @ApiOperation({ summary: 'Get available drug quantity by location' })
  getDrugQuantityByLocation(@Param('drugId') drugId: string) {
    return this.service.getDrugQuantityByLocation(drugId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pharmacy location by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a pharmacy location' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePharmacyLocationDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pharmacy location' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
