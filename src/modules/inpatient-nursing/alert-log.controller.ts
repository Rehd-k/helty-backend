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
import { INPATIENT_NURSING_READ_ACCESS, INPATIENT_NURSING_WRITE_ACCESS, NURSING_ASSIGNMENT_WITH_DOCTORS } from '../nursing/nursing.constants';
import { AlertLogService } from './alert-log.service';
import { CreateAlertLogDto, ResolveAlertLogDto } from './dto/alert-log.dto';

@ApiTags('Inpatient — alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/alerts')
export class AlertLogController {
  constructor(private readonly service: AlertLogService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
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
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'Create an alert for an admission' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateAlertLogDto,
  ) {
    return this.service.create(admissionId, dto);
  }

  @Patch(':alertId/resolve')
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
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
