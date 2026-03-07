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
import { AntenatalVisitService } from './antenatal-visit.service';
import { CreateAntenatalVisitDto, UpdateAntenatalVisitDto } from './dto/create-antenatal-visit.dto';
import { ListAntenatalVisitsQueryDto } from './dto/list-antenatal-visits-query.dto';

@ApiTags('Obstetrics – Antenatal')
@Controller('obstetrics')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
export class AntenatalVisitController {
  constructor(private readonly antenatalVisitService: AntenatalVisitService) {}

  @Post('pregnancies/:pregnancyId/visits')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an antenatal visit for a pregnancy' })
  create(
    @Param('pregnancyId') pregnancyId: string,
    @Body() dto: Omit<CreateAntenatalVisitDto, 'pregnancyId'>,
  ) {
    return this.antenatalVisitService.create({ ...dto, pregnancyId });
  }

  @Get('pregnancies/:pregnancyId/visits')
  @ApiOperation({ summary: 'List antenatal visits for a pregnancy' })
  findByPregnancy(
    @Param('pregnancyId') pregnancyId: string,
    @Query() query: ListAntenatalVisitsQueryDto,
  ) {
    return this.antenatalVisitService.findByPregnancy(pregnancyId, query);
  }

  @Get('antenatal-visits/:id')
  @ApiOperation({ summary: 'Get antenatal visit by ID' })
  findOne(@Param('id') id: string) {
    return this.antenatalVisitService.findOne(id);
  }

  @Patch('antenatal-visits/:id')
  @ApiOperation({ summary: 'Update antenatal visit' })
  update(@Param('id') id: string, @Body() dto: UpdateAntenatalVisitDto) {
    return this.antenatalVisitService.update(id, dto);
  }
}
