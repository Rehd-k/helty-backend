import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../common/decorators';
import { LabReportStorageService } from './lab-report-storage.service';

@ApiTags('Lab – Report files')
@Controller('uploads/lab-reports')
export class LabReportFileController {
  constructor(private readonly storage: LabReportStorageService) {}

  @Public()
  @Get(':filename')
  @ApiOperation({
    summary: 'Serve a stored laboratory report PDF (used by WhatsApp document links)',
  })
  serve(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.storage.resolvePath(filename);
    if (!filePath) {
      throw new NotFoundException('Laboratory report not found');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="Lab_Results.pdf"',
    );
    return res.sendFile(filePath);
  }
}
