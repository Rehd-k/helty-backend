import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { AccessGuard, JwtAuthGuard } from '../../common/guards';
import { DbBackupService } from './db-backup.service';

type JwtUser = {
  accountType?: string;
  staffRole?: string;
};

function assertSuperAdminOnly(user: JwtUser | undefined): void {
  const accountType = (user?.accountType ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
  const staffRole = (user?.staffRole ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
  if (accountType !== 'SUPER_ADMIN' && staffRole !== 'SUPER_ADMIN') {
    throw new ForbiddenException('Only SUPER_ADMIN can manage database backups');
  }
}

@ApiTags('Admin – DB Backups')
@Controller('admin/db-backups')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('SUPER_ADMIN')
export class DbBackupController {
  constructor(private readonly dbBackupService: DbBackupService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a database backup now (SUPER_ADMIN)',
  })
  async create(@Req() req: { user?: JwtUser }) {
    assertSuperAdminOnly(req.user);
    return this.dbBackupService.createBackup('manual');
  }

  @Get()
  @ApiOperation({
    summary: 'List database backup files (SUPER_ADMIN)',
  })
  list(@Req() req: { user?: JwtUser }) {
    assertSuperAdminOnly(req.user);
    return this.dbBackupService.listBackups();
  }

  @Get(':filename')
  @ApiOperation({
    summary: 'Download a database backup file (SUPER_ADMIN)',
  })
  @Header('Cache-Control', 'no-store')
  download(
    @Param('filename') filename: string,
    @Req() req: { user?: JwtUser },
  ): StreamableFile {
    assertSuperAdminOnly(req.user);
    return this.dbBackupService.getBackupStream(filename);
  }
}
