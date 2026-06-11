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
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { NURSING_CHARGE_ACCESS } from './nursing.constants';
import { NursingRosterService } from './nursing-roster.service';
import {
  CreateNurseShiftRosterDto,
  QueryNurseShiftRosterDto,
  UpdateNurseShiftRosterDto,
} from './dto/nursing-roster.dto';

@ApiTags('Nursing — shift rosters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('nursing/rosters')
export class NursingRosterController {
  constructor(private readonly roster: NursingRosterService) {}

  @Get()
  @AccountTypes(...NURSING_CHARGE_ACCESS)
  @ApiOperation({ summary: 'List shift roster entries (scoped by role)' })
  list(@Query() query: QueryNurseShiftRosterDto, @Req() req: { user: { sub: string } }) {
    return this.roster.list(req.user.sub, query);
  }

  @Get('summary')
  @AccountTypes(...NURSING_CHARGE_ACCESS)
  @ApiOperation({ summary: 'Roster coverage summary for a shift day' })
  summary(@Query() query: QueryNurseShiftRosterDto, @Req() req: { user: { sub: string } }) {
    return this.roster.summary(req.user.sub, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...NURSING_CHARGE_ACCESS)
  @ApiOperation({ summary: 'Add nurse to shift roster' })
  create(
    @Body() dto: CreateNurseShiftRosterDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.roster.create(req.user.sub, dto);
  }

  @Patch(':id')
  @AccountTypes(...NURSING_CHARGE_ACCESS)
  @ApiOperation({ summary: 'Update roster entry' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNurseShiftRosterDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.roster.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...NURSING_CHARGE_ACCESS)
  @ApiOperation({ summary: 'Remove roster entry' })
  async remove(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    await this.roster.remove(req.user.sub, id);
  }
}
