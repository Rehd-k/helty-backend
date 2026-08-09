import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { ListHealthContentQueryDto } from './dto/health-content.dto';
import { HealthContentService } from './health-content.service';

@ApiTags('patient-portal')
@ApiBearerAuth()
@Controller('patient/health')
export class PatientHealthContentController {
  constructor(private readonly service: HealthContentService) {}

  @Get('campaigns')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiOperation({
    summary: 'List published health campaigns (not expired)',
  })
  listCampaigns(@Query() query: ListHealthContentQueryDto) {
    return this.service.listPublishedCampaigns(query);
  }

  @Get('news')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiOperation({
    summary: 'List published health news articles (not expired)',
  })
  listNews(@Query() query: ListHealthContentQueryDto) {
    return this.service.listPublishedNews(query);
  }
}
