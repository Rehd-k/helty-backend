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
import { AccountTypes, Public } from '../../common/decorators';
import {
  CreateSystemAnnouncementDto,
  ListSystemAnnouncementsQueryDto,
  UpdateSystemAnnouncementDto,
} from './dto/system-announcement.dto';
import { SystemAnnouncementsService } from './system-announcements.service';

const ANNOUNCEMENT_ADMIN = [
  'SUPER_ADMIN',
  'CMD',
  'CMAC',
  'ADMIN',
] as const;

@ApiTags('System announcements')
@Controller('system-announcements')
export class SystemAnnouncementsController {
  constructor(private readonly service: SystemAnnouncementsService) {}

  @Get('active')
  @Public()
  @ApiOperation({
    summary: 'List active system announcements (public, no auth)',
  })
  listActive() {
    return this.service.listActive();
  }

  @Get()
  @ApiBearerAuth()
  @AccountTypes(...ANNOUNCEMENT_ADMIN)
  @ApiOperation({ summary: 'List all system announcements (staff admin)' })
  list(@Query() query: ListSystemAnnouncementsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @AccountTypes(...ANNOUNCEMENT_ADMIN)
  @ApiOperation({ summary: 'Get a system announcement' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @AccountTypes(...ANNOUNCEMENT_ADMIN)
  @ApiOperation({ summary: 'Create a system announcement' })
  create(
    @Body() dto: CreateSystemAnnouncementDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(dto, req.user.sub);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @AccountTypes(...ANNOUNCEMENT_ADMIN)
  @ApiOperation({ summary: 'Update a system announcement' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSystemAnnouncementDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @AccountTypes(...ANNOUNCEMENT_ADMIN)
  @ApiOperation({ summary: 'Delete a system announcement' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
