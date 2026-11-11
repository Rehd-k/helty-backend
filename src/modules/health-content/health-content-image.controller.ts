import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators';
import { resolveHealthContentImagePath } from './health-content-image.storage';

@ApiTags('Health content')
@Controller('uploads/health-content')
export class HealthContentImageController {
  @Public()
  @Get(':filename')
  @ApiOperation({ summary: 'Serve a campaign or news infographic' })
  serve(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = resolveHealthContentImagePath(filename);
    if (!filePath) {
      throw new NotFoundException('Image not found');
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }
}
