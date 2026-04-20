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
import { HandoverReportService } from './handover-report.service';
import { CreateHandoverReportDto } from './dto/nursing-docs.dto';

@ApiTags('Inpatient — handover reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/handover-reports')
export class HandoverReportController {
  constructor(private readonly service: HandoverReportService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List handover reports' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('NURSE', 'HEAD_NURSE')
  @ApiOperation({ summary: 'Create handover report' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateHandoverReportDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }
}
