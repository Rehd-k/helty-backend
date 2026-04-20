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
import { ProcedureRecordService } from './procedure-record.service';
import { CreateProcedureRecordDto } from './dto/nursing-docs.dto';

@ApiTags('Inpatient — procedure records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/procedure-records')
export class ProcedureRecordController {
  constructor(private readonly service: ProcedureRecordService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List procedure records' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('NURSE', 'HEAD_NURSE')
  @ApiOperation({ summary: 'Create procedure record' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateProcedureRecordDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }
}
