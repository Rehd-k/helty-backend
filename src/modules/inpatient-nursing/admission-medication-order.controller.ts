import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { INPATIENT_NURSING_READ_ACCESS, INPATIENT_NURSING_WRITE_ACCESS, NURSING_ASSIGNMENT_WITH_DOCTORS } from '../nursing/nursing.constants';
import { AdmissionMedicationOrderService } from './admission-medication-order.service';
import {
  CreateAdmissionMedicationOrderDto,
  UpdateAdmissionMedicationOrderDto,
} from './dto/admission-medication.dto';

@ApiTags('Inpatient — admission medication orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/medication-orders')
export class AdmissionMedicationOrderController {
  constructor(private readonly service: AdmissionMedicationOrderService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({
    summary: 'List inpatient medication orders for an admission',
  })
  @ApiParam({ name: 'admissionId' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...NURSING_ASSIGNMENT_WITH_DOCTORS, 'INPATIENT_NURSE', 'OUTPATIENT_NURSE')
  @ApiOperation({
    summary: 'Create an admission medication order (prescriber)',
  })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateAdmissionMedicationOrderDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }

  @Patch(':orderId')
  @AccountTypes(...NURSING_ASSIGNMENT_WITH_DOCTORS)
  @ApiOperation({ summary: 'Update an admission medication order' })
  update(
    @Param('admissionId') admissionId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateAdmissionMedicationOrderDto,
  ) {
    return this.service.update(admissionId, orderId, dto);
  }

  @Delete(':orderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...NURSING_ASSIGNMENT_WITH_DOCTORS)
  @ApiOperation({ summary: 'Delete an admission medication order' })
  async remove(
    @Param('admissionId') admissionId: string,
    @Param('orderId') orderId: string,
  ) {
    await this.service.remove(admissionId, orderId);
  }
}
