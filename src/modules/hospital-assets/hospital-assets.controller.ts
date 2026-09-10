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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { HospitalAssetsService } from './hospital-assets.service';
import {
  CreateHospitalAssetDto,
  CreateHospitalAssetLogDto,
  QueryHospitalAssetDto,
  TransferHospitalAssetDto,
  UpdateHospitalAssetDto,
  UpsertHospitalAssetAccessDto,
} from './dto/hospital-assets.dto';

@ApiTags('Hospital assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('hospital-assets')
export class HospitalAssetsController {
  constructor(private readonly service: HospitalAssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List hospital physical assets (scoped)' })
  list(
    @Query() query: QueryHospitalAssetDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.list(req.user.sub, query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current staff inventory access' })
  me(@Req() req: { user: { sub: string } }) {
    return this.service.me(req.user.sub);
  }

  @Get('access')
  @ApiOperation({ summary: 'List inventory access grants for a department' })
  listAccess(
    @Query('accountType') accountType: AccountType | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.listAccess(req.user.sub, accountType);
  }

  @Post('access')
  @ApiOperation({ summary: 'Grant view or log access to department inventory' })
  upsertAccess(
    @Body() dto: UpsertHospitalAssetAccessDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.upsertAccess(req.user.sub, dto);
  }

  @Delete('access/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke inventory access grant' })
  revokeAccess(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.revokeAccess(req.user.sub, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset with history logs' })
  get(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.service.get(req.user.sub, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a physical asset' })
  create(
    @Body() dto: CreateHospitalAssetDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(req.user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update asset details or status' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHospitalAssetDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(req.user.sub, id, dto);
  }

  @Post(':id/logs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Append a usage, movement, or maintenance log' })
  addLog(
    @Param('id') id: string,
    @Body() dto: CreateHospitalAssetLogDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.addLog(req.user.sub, id, dto);
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer asset to another department or hospital' })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferHospitalAssetDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.transfer(req.user.sub, id, dto);
  }
}
