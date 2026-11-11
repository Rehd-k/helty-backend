import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { AccountTypes } from '../../common/decorators';
import {
  HEALTH_CONTENT_IMAGE_MAX_BYTES,
  HEALTH_CONTENT_UPLOAD_DIR,
  healthContentImageFilename,
  isHealthContentImage,
} from './health-content-image.storage';
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

const imageUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(HEALTH_CONTENT_UPLOAD_DIR, { recursive: true });
      cb(null, HEALTH_CONTENT_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      cb(
        null,
        healthContentImageFilename(file.originalname || '', file.mimetype || ''),
      );
    },
  }),
  limits: { fileSize: HEALTH_CONTENT_IMAGE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isHealthContentImage(file.mimetype || '', file.originalname || '')) {
      return cb(new Error('File must be a JPG, PNG, WebP, or GIF image.'), false);
    }
    cb(null, true);
  },
});

@ApiTags('Health content')
@ApiBearerAuth()
@Controller('health-content')
@AccountTypes(...HEALTH_CONTENT_STAFF)
export class HealthContentController {
  constructor(private readonly service: HealthContentService) {}

  @Post('images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Upload an infographic for a campaign or news article',
  })
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.filename) {
      throw new BadRequestException('Image file is required.');
    }
    return { imageUrl: `/uploads/health-content/${file.filename}` };
  }

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
