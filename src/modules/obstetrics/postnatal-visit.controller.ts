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
import { OBSTETRICS_PHYSICIAN_ACCESS } from './obstetrics.constants';
import { PostnatalVisitService } from './postnatal-visit.service';
import {
  CreatePostnatalVisitDto,
  UpdatePostnatalVisitDto,
} from './dto/create-postnatal-visit.dto';
import { ListPostnatalVisitsQueryDto } from './dto/list-postnatal-visits-query.dto';

@ApiTags('Obstetrics – Postnatal')
@Controller('obstetrics/postnatal-visits')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PostnatalVisitController {
  constructor(private readonly postnatalVisitService: PostnatalVisitService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...OBSTETRICS_PHYSICIAN_ACCESS)
  @ApiOperation({ summary: 'Create a postnatal visit (mother or baby)' })
  create(@Body() dto: CreatePostnatalVisitDto) {
    return this.postnatalVisitService.create(dto);
  }

  @Get()
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'List postnatal visits' })
  findAll(@Query() query: ListPostnatalVisitsQueryDto) {
    return this.postnatalVisitService.findAll(query);
  }

  @Get(':id')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get postnatal visit by ID' })
  findOne(@Param('id') id: string) {
    return this.postnatalVisitService.findOne(id);
  }

  @Patch(':id')
  @AccountTypes(...OBSTETRICS_PHYSICIAN_ACCESS)
  @ApiOperation({ summary: 'Update postnatal visit' })
  update(@Param('id') id: string, @Body() dto: UpdatePostnatalVisitDto) {
    return this.postnatalVisitService.update(id, dto);
  }
}
