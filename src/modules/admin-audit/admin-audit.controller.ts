import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { AccessGuard, JwtAuthGuard } from '../../common/guards';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';

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
    throw new ForbiddenException('Only SUPER_ADMIN can view staff audit logs');
  }
}

@ApiTags('Admin – Audit logs')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('SUPER_ADMIN')
export class AdminAuditController {
  constructor(private readonly service: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Staff activity audit log (SUPER_ADMIN)' })
  list(@Query() q: AdminAuditQueryDto, @Req() req: { user?: JwtUser }) {
    assertSuperAdminOnly(req.user);
    return this.service.list(q);
  }
}
