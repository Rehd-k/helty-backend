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
  Put,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  CreateCyclePeriodDto,
  CycleCalendarQueryDto,
  UpdateCyclePeriodDto,
  UpdateCycleSettingsDto,
} from './dto/patient-cycle.dto';
import { PatientCycleService } from './patient-cycle.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientCycleController {
  constructor(private readonly patientCycleService: PatientCycleService) {}

  @Get('cycle/summary')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cycle tracker home summary for the logged-in patient' })
  @ApiResponse({ status: 200, description: 'Cycle summary' })
  getSummary(@Request() req: { user: PatientJwtPayload }) {
    return this.patientCycleService.getSummary(req.user);
  }

  @Get('cycle/calendar')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cycle calendar for a month' })
  @ApiResponse({ status: 200, description: 'Cycle calendar' })
  getCalendar(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: CycleCalendarQueryDto,
  ) {
    return this.patientCycleService.getCalendar(req.user, query);
  }

  @Put('cycle/settings')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update cycle length settings' })
  @ApiResponse({ status: 200, description: 'Cycle settings saved' })
  updateSettings(
    @Request() req: { user: PatientJwtPayload },
    @Body() dto: UpdateCycleSettingsDto,
  ) {
    return this.patientCycleService.updateSettings(req.user, dto);
  }

  @Post('cycle/periods')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a menstrual period' })
  @ApiResponse({ status: 201, description: 'Period created' })
  @ApiResponse({ status: 409, description: 'Overlapping period' })
  createPeriod(
    @Request() req: { user: PatientJwtPayload },
    @Body() dto: CreateCyclePeriodDto,
  ) {
    return this.patientCycleService.createPeriod(req.user, dto);
  }

  @Patch('cycle/periods/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a logged period' })
  @ApiResponse({ status: 200, description: 'Period updated' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  updatePeriod(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateCyclePeriodDto,
  ) {
    return this.patientCycleService.updatePeriod(req.user, id, dto);
  }

  @Delete('cycle/periods/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a logged period' })
  @ApiResponse({ status: 200, description: 'Period deleted' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  deletePeriod(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
  ) {
    return this.patientCycleService.deletePeriod(req.user, id);
  }
}
