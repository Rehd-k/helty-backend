import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyReportService } from './radiology-report.service';
import {
  CreateRadiologyStudyReportDto,
  UpdateRadiologyStudyReportDto,
} from './dto/radiology-report.dto';

@ApiTags('Radiology – Reporting')
@Controller('radiology/order-items/:orderItemId/report')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('CONSULTANT', 'INPATIENT_DOCTOR', 'RADIOLOGIST', 'RADIOLOGY')
export class RadiologyReportController {
  constructor(
    private readonly radiologyReportService: RadiologyReportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create radiology report (digitally signed by radiologist)',
  })
  create(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: CreateRadiologyStudyReportDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    const signedById = req.user?.sub;
    if (!signedById) {
      throw new Error('Unauthorized');
    }
    return this.radiologyReportService.create(orderItemId, dto, signedById);
  }

  @Patch()
  @ApiOperation({ summary: 'Update radiology report' })
  update(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: UpdateRadiologyStudyReportDto,
  ) {
    return this.radiologyReportService.update(orderItemId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get report for an order item (for viewing/print)' })
  getReport(@Param('orderItemId') orderItemId: string) {
    return this.radiologyReportService.getByOrderItemId(orderItemId);
  }
}
