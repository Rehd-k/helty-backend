import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../../common/guards';
import { AccountTypes } from '../../../common/decorators';
import { LabConfigTransferService } from './lab-config-transfer.service';
import { ImportLabConfigDto } from './dto/import-lab-config.dto';

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
    throw new ForbiddenException(
      'Only SUPER_ADMIN can export or import lab configuration',
    );
  }
}

@ApiTags('Lab – Config Transfer')
@Controller('lab/config')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('SUPER_ADMIN')
export class LabConfigTransferController {
  constructor(
    private readonly labConfigTransferService: LabConfigTransferService,
  ) {}

  @Get('export')
  @ApiOperation({
    summary: 'Export lab catalog configuration (SUPER_ADMIN)',
    description:
      'Downloads categories, tests, versions, fields, antibiotics, and AST options as a transferable JSON package.',
  })
  export(@Req() req: { user?: JwtUser }) {
    assertSuperAdminOnly(req.user);
    return this.labConfigTransferService.exportConfig();
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import lab catalog configuration (SUPER_ADMIN)',
    description:
      'Replaces the entire lab catalog with the uploaded package. Removes catalog-linked order lines and results.',
  })
  import(
    @Body() dto: ImportLabConfigDto,
    @Req() req: { user?: JwtUser },
  ) {
    assertSuperAdminOnly(req.user);
    return this.labConfigTransferService.importConfig(dto);
  }
}
