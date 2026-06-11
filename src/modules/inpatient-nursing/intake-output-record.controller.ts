import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { INPATIENT_NURSING_READ_ACCESS, INPATIENT_NURSING_WRITE_ACCESS, NURSING_ASSIGNMENT_WITH_DOCTORS } from '../nursing/nursing.constants';
import { IntakeOutputRecordService } from './intake-output-record.service';
import {
  CreateIntakeOutputRecordDto,
  UpdateIntakeOutputRecordDto,
} from './dto/intake-output.dto';

@ApiTags('Inpatient — intake & output')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/intake-output-records')
export class IntakeOutputRecordController {
  constructor(private readonly service: IntakeOutputRecordService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'List intake/output records' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...INPATIENT_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create intake/output record (nurse from JWT)' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateIntakeOutputRecordDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }

  @Patch(':recordId')
  @AccountTypes(...INPATIENT_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update own intake/output record' })
  update(
    @Param('admissionId') admissionId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateIntakeOutputRecordDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(admissionId, recordId, dto, req.user.sub);
  }
}
