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
import { DEPARTMENT_HEAD_ACCESS } from '../../common/constants/department-head.constants';
import { DepartmentHeadService } from './department-head.service';
import {
  CreateDepartmentRosterDto,
  QueryDepartmentRosterDto,
  QueryDepartmentStaffDto,
  UpdateDepartmentRosterDto,
} from './dto/department-head.dto';

@ApiTags('Department heads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('department-head')
export class DepartmentHeadController {
  constructor(private readonly service: DepartmentHeadService) {}

  @Get('staff')
  @AccountTypes(...DEPARTMENT_HEAD_ACCESS)
  @ApiOperation({ summary: 'List staff in the head’s department' })
  listStaff(
    @Query() query: QueryDepartmentStaffDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.listStaff(req.user.sub, query);
  }

  @Get('rosters')
  @AccountTypes(...DEPARTMENT_HEAD_ACCESS)
  @ApiOperation({ summary: 'List department shift roster entries' })
  listRosters(
    @Query() query: QueryDepartmentRosterDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.listRosters(req.user.sub, query);
  }

  @Get('rosters/summary')
  @AccountTypes(...DEPARTMENT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Morning / afternoon / night coverage for a day' })
  rosterSummary(
    @Query() query: QueryDepartmentRosterDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.rosterSummary(req.user.sub, query);
  }

  @Post('rosters')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...DEPARTMENT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Add a staff member to a shift' })
  createRoster(
    @Body() dto: CreateDepartmentRosterDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createRoster(req.user.sub, dto);
  }

  @Patch('rosters/:id')
  @AccountTypes(...DEPARTMENT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Update a department roster entry' })
  updateRoster(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentRosterDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.updateRoster(req.user.sub, id, dto);
  }

  @Delete('rosters/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...DEPARTMENT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Remove a department roster entry' })
  removeRoster(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.removeRoster(req.user.sub, id);
  }
}
