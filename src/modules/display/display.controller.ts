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
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { AccountTypes, AllowDisplay } from '../../common/decorators';
import { generateSafeNanoid } from '../../common/utils/human-readable-id.util';
import { DisplayBoardService } from './display-board.service';
import { DisplayVideoService } from './display-video.service';
import {
  ReorderDisplayVideosDto,
  UpdateDisplayVideoDto,
} from './dto/display-video.dto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'display-media');
const MAX_FILE_SIZE = 200 * 1024 * 1024;
const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]);

const videoUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
      cb(null, `${generateSafeNanoid()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype?.toLowerCase();
    if (!mime || !VIDEO_MIMES.has(mime)) {
      return cb(new Error('File must be an MP4, WebM, MOV, or AVI video.'), false);
    }
    cb(null, true);
  },
});

type DisplayRequest = {
  user?: { sub?: string; accountType?: string };
};

@ApiTags('Display')
@Controller('display')
export class DisplayController {
  constructor(
    private readonly board: DisplayBoardService,
    private readonly videos: DisplayVideoService,
  ) {}

  @Get('board')
  @AllowDisplay()
  @ApiOperation({ summary: 'Waiting-room board for the signed-in display account' })
  boardFor(@Req() req: DisplayRequest) {
    return this.board.boardForStaff(req.user?.sub ?? '');
  }

  @Get('videos')
  @AllowDisplay()
  @AccountTypes('ICT', 'ICT_HEAD', 'ICT_STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Active waiting-room videos, in play order' })
  listActive(@Req() req: DisplayRequest) {
    return this.videos.listActiveFor(req.user);
  }

  @Get('videos/manage')
  @AccountTypes('ICT', 'ICT_HEAD', 'ICT_STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'All waiting-room videos, including inactive ones' })
  listAll() {
    return this.videos.listAll();
  }

  @Post('videos')
  @AccountTypes('ICT', 'ICT_HEAD', 'ICT_STAFF', 'SUPER_ADMIN')
  @UseInterceptors(videoUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a video for every waiting-room screen' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string | undefined,
    @Req() req: DisplayRequest,
  ) {
    return this.videos.upload(file, title, req.user?.sub ?? '');
  }

  @Patch('videos/order')
  @AccountTypes('ICT', 'ICT_HEAD', 'ICT_STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Set the shared playlist order' })
  reorder(@Body() dto: ReorderDisplayVideosDto) {
    return this.videos.reorder(dto.orderedIds);
  }

  @Patch('videos/:id')
  @AccountTypes('ICT', 'ICT_HEAD', 'ICT_STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Rename a video or show/hide it on the screens' })
  update(@Param('id') id: string, @Body() dto: UpdateDisplayVideoDto) {
    return this.videos.update(id, dto);
  }

  @Delete('videos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes('ICT', 'ICT_HEAD', 'ICT_STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Remove a waiting-room video' })
  remove(@Param('id') id: string) {
    return this.videos.remove(id);
  }

  @Get('videos/:id/file')
  @AllowDisplay()
  @AccountTypes('ICT', 'ICT_HEAD', 'ICT_STAFF', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Stream a waiting-room video' })
  async file(
    @Param('id') id: string,
    @Req() req: DisplayRequest,
    @Res() res: any,
  ) {
    const video = await this.videos.fileFor(id, req.user);
    res.setHeader('Content-Type', video.mimeType || 'video/mp4');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(video.fileName)}"`,
    );
    res.sendFile(path.resolve(video.filePath));
  }
}
