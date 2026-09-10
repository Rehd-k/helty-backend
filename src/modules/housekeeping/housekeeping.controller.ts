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
import { HOUSEKEEPING_ACCESS } from '../../common/constants/department-head.constants';
import { HousekeepingService } from './housekeeping.service';
import {
  AssignHousekeepingAreaDto,
  CreateHousekeepingAreaDto,
  CreateHousekeepingShiftDto,
  CreateHousekeepingSupplyLogDto,
  CreateHousekeepingWorkerDto,
  QueryHousekeepingShiftDto,
  UpdateHousekeepingAreaDto,
  UpdateHousekeepingWorkerDto,
} from './dto/housekeeping.dto';

@ApiTags('Housekeeping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...HOUSEKEEPING_ACCESS)
@Controller('housekeeping')
export class HousekeepingController {
  constructor(private readonly service: HousekeepingService) {}

  @Get('workers')
  @ApiOperation({ summary: 'List janitorial staff records' })
  listWorkers() {
    return this.service.listWorkers();
  }

  @Get('workers/:id')
  @ApiOperation({ summary: 'Get a janitorial staff record' })
  getWorker(@Param('id') id: string) {
    return this.service.getWorker(id);
  }

  @Post('workers')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a janitorial staff record (no login)' })
  createWorker(
    @Body() dto: CreateHousekeepingWorkerDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createWorker(req.user.sub, dto);
  }

  @Patch('workers/:id')
  @ApiOperation({ summary: 'Update a janitorial staff record' })
  updateWorker(
    @Param('id') id: string,
    @Body() dto: UpdateHousekeepingWorkerDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.updateWorker(req.user.sub, id, dto);
  }

  @Post('workers/:id/areas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign an area to a worker' })
  assignArea(
    @Param('id') id: string,
    @Body() dto: AssignHousekeepingAreaDto,
  ) {
    return this.service.assignArea(id, dto);
  }

  @Delete('workers/:id/areas/:areaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an area assignment' })
  unassignArea(
    @Param('id') id: string,
    @Param('areaId') areaId: string,
  ) {
    return this.service.unassignArea(id, areaId);
  }

  @Get('areas')
  @ApiOperation({ summary: 'List housekeeping areas / rooms' })
  listAreas() {
    return this.service.listAreas();
  }

  @Post('areas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a housekeeping area' })
  createArea(
    @Body() dto: CreateHousekeepingAreaDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createArea(req.user.sub, dto);
  }

  @Patch('areas/:id')
  @ApiOperation({ summary: 'Update a housekeeping area' })
  updateArea(
    @Param('id') id: string,
    @Body() dto: UpdateHousekeepingAreaDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.updateArea(req.user.sub, id, dto);
  }

  @Get('shifts')
  @ApiOperation({ summary: 'List housekeeping worker shifts' })
  listShifts(@Query() query: QueryHousekeepingShiftDto) {
    return this.service.listShifts(query);
  }

  @Get('shifts/summary')
  @ApiOperation({ summary: 'Morning / afternoon / night worker coverage' })
  shiftSummary(@Query() query: QueryHousekeepingShiftDto) {
    return this.service.shiftSummary(query);
  }

  @Post('shifts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a worker to a shift' })
  createShift(
    @Body() dto: CreateHousekeepingShiftDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createShift(req.user.sub, dto);
  }

  @Delete('shifts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a worker shift' })
  removeShift(@Param('id') id: string) {
    return this.service.removeShift(id);
  }

  @Get('supplies')
  @ApiOperation({ summary: 'List housekeeping supply logs' })
  listSupplies() {
    return this.service.listSupplyLogs();
  }

  @Post('supplies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log detergent / bucket / supply usage' })
  createSupply(
    @Body() dto: CreateHousekeepingSupplyLogDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createSupplyLog(req.user.sub, dto);
  }
}
