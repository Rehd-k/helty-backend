import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { INPATIENT_NURSING_READ_ACCESS, INPATIENT_NURSING_WRITE_ACCESS, NURSING_ASSIGNMENT_WITH_DOCTORS } from '../nursing/nursing.constants';
import { HandoverReportService } from './handover-report.service';
import { CreateHandoverReportDto } from './dto/nursing-docs.dto';

@ApiTags('Inpatient — handover reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/handover-reports')
export class HandoverReportController {
  constructor(private readonly service: HandoverReportService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'List handover reports' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...INPATIENT_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create handover report' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateHandoverReportDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }
}
