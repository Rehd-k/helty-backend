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
import { IvMonitoringService } from './iv-monitoring.service';
import { CreateIvMonitoringDto } from './dto/iv.dto';

@ApiTags('Inpatient — IV monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/iv-fluid-orders/:orderId/monitorings')
export class IvMonitoringController {
  constructor(private readonly service: IvMonitoringService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List IV monitoring entries for an order' })
  list(
    @Param('admissionId') admissionId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.service.list(admissionId, orderId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('NURSE', 'HEAD_NURSE')
  @ApiOperation({ summary: 'Add IV monitoring row (nurse from JWT)' })
  create(
    @Param('admissionId') admissionId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CreateIvMonitoringDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, orderId, dto, req.user.sub);
  }
}
