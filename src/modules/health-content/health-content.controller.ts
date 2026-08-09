import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import {
  CreateHealthCampaignDto,
  CreateHealthNewsArticleDto,
  ListHealthContentQueryDto,
  UpdateHealthCampaignDto,
  UpdateHealthNewsArticleDto,
} from './dto/health-content.dto';
import { HealthContentService } from './health-content.service';

const HEALTH_CONTENT_STAFF = [
  'MEDICAL_RECORDS',
  'CMD',
  'SUPER_ADMIN',
  'CMAC',
] as const;

@ApiTags('Health content')
@ApiBearerAuth()
@Controller('health-content')
@AccountTypes(...HEALTH_CONTENT_STAFF)
export class HealthContentController {
  constructor(private readonly service: HealthContentService) {}

  // ─── Campaigns ────────────────────────────────────────────────────────────

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a health campaign' })
  createCampaign(
    @Body() dto: CreateHealthCampaignDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createCampaign(dto, req.user.sub);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List health campaigns (staff)' })
  listCampaigns(@Query() query: ListHealthContentQueryDto) {
    return this.service.listCampaigns(query);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get a health campaign' })
  getCampaign(@Param('id') id: string) {
    return this.service.getCampaign(id);
  }

  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Update a health campaign' })
  updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateHealthCampaignDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.updateCampaign(id, dto, req.user.sub);
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete a health campaign' })
  deleteCampaign(@Param('id') id: string) {
    return this.service.deleteCampaign(id);
  }

  // ─── News ─────────────────────────────────────────────────────────────────

  @Post('news')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a health news article' })
  createNews(
    @Body() dto: CreateHealthNewsArticleDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createNews(dto, req.user.sub);
  }

  @Get('news')
  @ApiOperation({ summary: 'List health news articles (staff)' })
  listNews(@Query() query: ListHealthContentQueryDto) {
    return this.service.listNews(query);
  }

  @Get('news/:id')
  @ApiOperation({ summary: 'Get a health news article' })
  getNews(@Param('id') id: string) {
    return this.service.getNews(id);
  }

  @Patch('news/:id')
  @ApiOperation({ summary: 'Update a health news article' })
  updateNews(
    @Param('id') id: string,
    @Body() dto: UpdateHealthNewsArticleDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.updateNews(id, dto, req.user.sub);
  }

  @Delete('news/:id')
  @ApiOperation({ summary: 'Delete a health news article' })
  deleteNews(@Param('id') id: string) {
    return this.service.deleteNews(id);
  }
}
