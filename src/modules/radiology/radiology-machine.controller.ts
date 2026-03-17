import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyMachineService } from './radiology-machine.service';
import { RadiologyModality } from '@prisma/client';

@ApiTags('Radiology – Machines')
@Controller('radiology/machines')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(
  'RADIOLOGY_RECEPTIONIST',
  'RADIOGRAPHER',
  'RADIOLOGIST',
  'RADIOLOGY',
)
export class RadiologyMachineController {
  constructor(
    private readonly radiologyMachineService: RadiologyMachineService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List radiology machines (for scheduling)' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Default true',
  })
  findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly === 'false' ? false : true;
    return this.radiologyMachineService.findAll(active);
  }

  @Get('by-modality/:modality')
  @ApiOperation({ summary: 'List machines by modality' })
  findByModality(@Param('modality') modality: RadiologyModality) {
    return this.radiologyMachineService.findByModality(modality);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one machine' })
  findOne(@Param('id') id: string) {
    return this.radiologyMachineService.findOne(id);
  }
}
