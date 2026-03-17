import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyRequestService } from './radiology-request.service';
import { CreateRadiologyRequestDto } from './dto/create-radiology-request.dto';
import { UpdateRadiologyRequestDto } from './dto/update-radiology-request.dto';
import { ListRadiologyRequestsQueryDto } from './dto/list-radiology-requests-query.dto';

@ApiTags('Radiology – Requests')
@Controller('radiology/requests')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(
  'CONSULTANT',
  'INPATIENT_DOCTOR',
  'RADIOLOGIST',
  'RADIOGRAPHER',
  'RADIOLOGY_RECEPTIONIST',
  'RADIOLOGY',
)
export class RadiologyRequestController {
  constructor(
    private readonly radiologyRequestService: RadiologyRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a radiology request (doctor orders imaging)',
  })
  create(@Body() dto: CreateRadiologyRequestDto) {
    return this.radiologyRequestService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List radiology requests with optional filters (worklist)',
  })
  findAll(@Query() query: ListRadiologyRequestsQueryDto) {
    return this.radiologyRequestService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get one radiology request with schedule, procedure, images, report',
  })
  findOne(@Param('id') id: string) {
    return this.radiologyRequestService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update radiology request (e.g. cancel, status, notes)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateRadiologyRequestDto) {
    return this.radiologyRequestService.update(id, dto);
  }
}
