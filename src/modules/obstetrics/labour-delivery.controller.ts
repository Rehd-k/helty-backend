import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { OBSTETRICS_PHYSICIAN_ACCESS } from './obstetrics.constants';
import { LabourDeliveryService } from './labour-delivery.service';
import {
  CreateLabourDeliveryDto,
  UpdateLabourDeliveryDto,
} from './dto/create-labour-delivery.dto';

@ApiTags('Obstetrics - Labour & delivery')
@Controller('obstetrics')
@UseGuards(JwtAuthGuard, AccessGuard)
export class LabourDeliveryController {
  constructor(private readonly labourDeliveryService: LabourDeliveryService) {}

  @Post('pregnancies/:pregnancyId/labour-deliveries')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...OBSTETRICS_PHYSICIAN_ACCESS)
  @ApiOperation({ summary: 'Create a labour/delivery record for a pregnancy' })
  create(
    @Param('pregnancyId') pregnancyId: string,
    @Body() dto: Omit<CreateLabourDeliveryDto, 'pregnancyId'>,
  ) {
    return this.labourDeliveryService.create({ ...dto, pregnancyId });
  }

  @Get('labour-deliveries/:id')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get labour/delivery by ID' })
  findOne(@Param('id') id: string) {
    return this.labourDeliveryService.findOne(id);
  }

  @Get('admissions/:admissionId/labour-delivery')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get labour/delivery for an admission' })
  findByAdmission(@Param('admissionId') admissionId: string) {
    return this.labourDeliveryService.findByAdmission(admissionId);
  }

  @Patch('labour-deliveries/:id')
  @AccountTypes(...OBSTETRICS_PHYSICIAN_ACCESS)
  @ApiOperation({ summary: 'Update labour/delivery' })
  update(@Param('id') id: string, @Body() dto: UpdateLabourDeliveryDto) {
    return this.labourDeliveryService.update(id, dto);
  }
}
