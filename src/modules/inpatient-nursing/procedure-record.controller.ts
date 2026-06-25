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
import {
  INPATIENT_NURSING_READ_ACCESS,
  INPATIENT_PROCEDURE_RECORD_WRITE_ACCESS,
} from '../nursing/nursing.constants';
import { ProcedureRecordService } from './procedure-record.service';
import { CreateProcedureRecordDto } from './dto/nursing-docs.dto';

@ApiTags('Inpatient — procedure records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/procedure-records')
export class ProcedureRecordController {
  constructor(private readonly service: ProcedureRecordService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'List procedure records' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...INPATIENT_PROCEDURE_RECORD_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create procedure record' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateProcedureRecordDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }
}
