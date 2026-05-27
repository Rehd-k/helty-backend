import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QualitySafetyService } from './quality-safety.service';
import { QualitySafetyListQueryDto } from './dto/quality-safety-list.query.dto';
import { CreateReferralDto, UpdateReferralDto } from './dto/referral.dto';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaint.dto';
import { CreateIncidentDto, UpdateIncidentDto } from './dto/incident.dto';
import { CreateInfectionDto, UpdateInfectionDto } from './dto/infection.dto';

@ApiTags('Quality & Safety')
@ApiBearerAuth()
@Controller('quality-safety')
export class QualitySafetyController {
  constructor(private readonly service: QualitySafetyService) {}

  @Post('referrals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a patient referral (in or out)' })
  createReferral(
    @Body() dto: CreateReferralDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createReferral(dto, req.user.sub);
  }

  @Get('referrals')
  @ApiOperation({ summary: 'List referrals with filters' })
  listReferrals(@Query() q: QualitySafetyListQueryDto) {
    return this.service.listReferrals(q);
  }

  @Get('referrals/:id')
  getReferral(@Param('id') id: string) {
    return this.service.getReferral(id);
  }

  @Patch('referrals/:id')
  updateReferral(@Param('id') id: string, @Body() dto: UpdateReferralDto) {
    return this.service.updateReferral(id, dto);
  }

  @Post('complaints')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a patient complaint' })
  createComplaint(
    @Body() dto: CreateComplaintDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createComplaint(dto, req.user.sub);
  }

  @Get('complaints')
  listComplaints(@Query() q: QualitySafetyListQueryDto) {
    return this.service.listComplaints(q);
  }

  @Get('complaints/:id')
  getComplaint(@Param('id') id: string) {
    return this.service.getComplaint(id);
  }

  @Patch('complaints/:id')
  updateComplaint(@Param('id') id: string, @Body() dto: UpdateComplaintDto) {
    return this.service.updateComplaint(id, dto);
  }

  @Post('incidents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Report a safety incident' })
  createIncident(
    @Body() dto: CreateIncidentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createIncident(dto, req.user.sub);
  }

  @Get('incidents')
  listIncidents(@Query() q: QualitySafetyListQueryDto) {
    return this.service.listIncidents(q);
  }

  @Get('incidents/:id')
  getIncident(@Param('id') id: string) {
    return this.service.getIncident(id);
  }

  @Patch('incidents/:id')
  updateIncident(@Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.service.updateIncident(id, dto);
  }

  @Post('infections')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an infection surveillance case' })
  createInfection(
    @Body() dto: CreateInfectionDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.createInfection(dto, req.user.sub);
  }

  @Get('infections')
  listInfections(@Query() q: QualitySafetyListQueryDto) {
    return this.service.listInfections(q);
  }

  @Get('infections/:id')
  getInfection(@Param('id') id: string) {
    return this.service.getInfection(id);
  }

  @Patch('infections/:id')
  updateInfection(@Param('id') id: string, @Body() dto: UpdateInfectionDto) {
    return this.service.updateInfection(id, dto);
  }
}
