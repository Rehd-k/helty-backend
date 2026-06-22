import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { OBSTETRICS_GYNAE_WRITE_ACCESS } from './obstetrics.constants';
import { GynaeProcedureService } from './gynae-procedure.service';
import {
  CreateGynaeProcedureDto,
  UpdateGynaeProcedureDto,
} from './dto/create-gynae-procedure.dto';
import { ListGynaeProceduresQueryDto } from './dto/list-gynae-procedures-query.dto';

@ApiTags('Obstetrics – Gynaecology')
@Controller('obstetrics/gynae-procedures')
@UseGuards(JwtAuthGuard, AccessGuard)
export class GynaeProcedureController {
  constructor(private readonly gynaeProcedureService: GynaeProcedureService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...OBSTETRICS_GYNAE_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create a gynaecology procedure' })
  create(@Body() dto: CreateGynaeProcedureDto) {
    return this.gynaeProcedureService.create(dto);
  }

  @Get()
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({
    summary:
      'List gynae procedures (optional: patientId, fromDate, toDate, procedureType)',
  })
  findAll(@Query() query: ListGynaeProceduresQueryDto) {
    return this.gynaeProcedureService.findAll(query);
  }

  @Get(':id')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get gynae procedure by ID' })
  findOne(@Param('id') id: string) {
    return this.gynaeProcedureService.findOne(id);
  }

  @Patch(':id')
  @AccountTypes(...OBSTETRICS_GYNAE_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update gynae procedure' })
  update(@Param('id') id: string, @Body() dto: UpdateGynaeProcedureDto) {
    return this.gynaeProcedureService.update(id, dto);
  }
}
