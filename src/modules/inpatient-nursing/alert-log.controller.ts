import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { AlertLogService } from './alert-log.service';
import { CreateAlertLogDto, ResolveAlertLogDto } from './dto/alert-log.dto';

@ApiTags('Inpatient — alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/alerts')
export class AlertLogController {
  constructor(private readonly service: AlertLogService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List alerts for an admission' })
  list(
    @Param('admissionId') admissionId: string,
    @Query('unresolvedOnly') unresolvedOnly?: string,
  ) {
    const only = unresolvedOnly === 'true' || unresolvedOnly === '1';
    return this.service.list(admissionId, only);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'Create an alert for an admission' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateAlertLogDto,
  ) {
    return this.service.create(admissionId, dto);
  }

  @Patch(':alertId/resolve')
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'Mark alert resolved (resolver from JWT)' })
  resolve(
    @Param('admissionId') admissionId: string,
    @Param('alertId') alertId: string,
    @Body() dto: ResolveAlertLogDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.resolve(admissionId, alertId, dto, req.user.sub);
  }
}
