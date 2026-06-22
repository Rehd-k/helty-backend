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
import {
  OBSTETRICS_NURSING_WRITE_ACCESS,
} from './obstetrics.constants';
import { AntenatalVisitService } from './antenatal-visit.service';
import {
  CreateAntenatalVisitDto,
  UpdateAntenatalVisitDto,
} from './dto/create-antenatal-visit.dto';
import { ListAntenatalVisitsQueryDto } from './dto/list-antenatal-visits-query.dto';

@ApiTags('Obstetrics - Antenatal')
@Controller('obstetrics')
@UseGuards(JwtAuthGuard, AccessGuard)
export class AntenatalVisitController {
  constructor(private readonly antenatalVisitService: AntenatalVisitService) {}

  @Post('pregnancies/:pregnancyId/visits')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...OBSTETRICS_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create an antenatal visit for a pregnancy' })
  create(
    @Param('pregnancyId') pregnancyId: string,
    @Body() dto: Omit<CreateAntenatalVisitDto, 'pregnancyId'>,
  ) {
    return this.antenatalVisitService.create({ ...dto, pregnancyId });
  }

  @Get('pregnancies/:pregnancyId/visits')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'List antenatal visits for a pregnancy' })
  findByPregnancy(
    @Param('pregnancyId') pregnancyId: string,
    @Query() query: ListAntenatalVisitsQueryDto,
  ) {
    return this.antenatalVisitService.findByPregnancy(pregnancyId, query);
  }

  @Get('antenatal-visits/:id')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get antenatal visit by ID' })
  findOne(@Param('id') id: string) {
    return this.antenatalVisitService.findOne(id);
  }

  @Patch('antenatal-visits/:id')
  @AccountTypes(...OBSTETRICS_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update antenatal visit' })
  update(@Param('id') id: string, @Body() dto: UpdateAntenatalVisitDto) {
    return this.antenatalVisitService.update(id, dto);
  }
}
