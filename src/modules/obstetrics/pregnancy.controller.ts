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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { OBSTETRICS_NURSING_WRITE_ACCESS } from './obstetrics.constants';
import { PregnancyService } from './pregnancy.service';
import {
  CreatePregnancyDto,
  UpdatePregnancyDto,
} from './dto/create-pregnancy.dto';
import { ListPregnanciesQueryDto } from './dto/list-pregnancies-query.dto';

@ApiTags('Obstetrics – Antenatal')
@Controller('obstetrics/pregnancies')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PregnancyController {
  constructor(private readonly pregnancyService: PregnancyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...OBSTETRICS_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create a pregnancy record' })
  create(@Body() dto: CreatePregnancyDto, @Req() req: any) {
    return this.pregnancyService.create(dto, req.user?.sub);
  }

  @Get()
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'List pregnancies (optional: patientId, status)' })
  findAll(@Query() query: ListPregnanciesQueryDto) {
    return this.pregnancyService.findAll(query);
  }

  @Get(':id')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get pregnancy by ID' })
  findOne(@Param('id') id: string) {
    return this.pregnancyService.findOne(id);
  }

  @Patch(':id')
  @AccountTypes(...OBSTETRICS_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update pregnancy' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePregnancyDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pregnancyService.update(id, dto, req.user.sub);
  }
}
