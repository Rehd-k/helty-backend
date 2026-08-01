import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { StaffRole } from '@prisma/client';
import {
  ListStaffEmergencyRequestQueryDto,
  UpdateEmergencyRequestDto,
} from './dto/emergency-requests.dto';
import { EmergencyRequestsService } from './emergency-requests.service';

/** ED nurses, charge, matron, physicians, and super admin. */
export const EMERGENCY_REQUEST_ACCESS = [
  'NURSE',
  'PHYSICIAN',
  StaffRole.EMERGENCY_NURSE,
  StaffRole.EMERGENCY_CHARGE_NURSE,
  StaffRole.MATRON,
  StaffRole.SUPER_ADMIN,
  'SUPER_ADMIN',
  'CMD',
] as const;

@ApiTags('emergency-requests')
@ApiBearerAuth()
@Controller('emergency/requests')
export class EmergencyRequestsController {
  constructor(
    private readonly emergencyRequestsService: EmergencyRequestsService,
  ) {}

  @Get()
  @AccountTypes(...EMERGENCY_REQUEST_ACCESS)
  @ApiOperation({ summary: 'List emergency service requests for ED' })
  @ApiResponse({ status: 200, description: 'Paginated emergency requests' })
  list(@Query() query: ListStaffEmergencyRequestQueryDto) {
    return this.emergencyRequestsService.list(query);
  }

  @Get(':id/media/:kind')
  @AccountTypes(...EMERGENCY_REQUEST_ACCESS)
  @ApiOperation({ summary: 'Stream voice or video attachment' })
  streamMedia(@Param('id') id: string, @Param('kind') kind: string) {
    return this.emergencyRequestsService.streamMedia(id, kind);
  }

  @Get(':id')
  @AccountTypes(...EMERGENCY_REQUEST_ACCESS)
  @ApiOperation({ summary: 'Get emergency request detail' })
  get(@Param('id') id: string) {
    return this.emergencyRequestsService.get(id);
  }

  @Patch(':id')
  @AccountTypes(...EMERGENCY_REQUEST_ACCESS)
  @ApiOperation({ summary: 'Update emergency request status' })
  update(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyRequestDto,
  ) {
    return this.emergencyRequestsService.update(req.user.sub, id, dto);
  }
}
