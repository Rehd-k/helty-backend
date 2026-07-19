import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { LinkChildDto } from './dto/link-child.dto';
import { ListPatientDevicesQueryDto } from './dto/list-patient-devices-query.dto';
import { FrontdeskFamilyService } from './frontdesk-family.service';
import { FrontdeskPatientDeviceService } from './frontdesk-patient-device.service';

const FRONTDESK_TYPES = [
  'FRONTDESK',
  'FRONT_DESK',
  'MEDICAL_RECORDS',
] as const;

@ApiTags('Frontdesk')
@ApiBearerAuth()
@Controller('frontdesk')
export class FrontdeskPatientAccessController {
  constructor(
    private readonly devices: FrontdeskPatientDeviceService,
    private readonly family: FrontdeskFamilyService,
  ) {}

  @Get('patient-devices')
  @AccountTypes(...FRONTDESK_TYPES)
  @ApiOperation({
    summary: 'List patient devices (filter by PENDING for approval queue)',
  })
  @ApiResponse({ status: 200, description: 'Paginated device list' })
  listDevices(@Query() query: ListPatientDevicesQueryDto) {
    return this.devices.listDevices(query);
  }

  @Get('patients/:patientId/devices')
  @AccountTypes(...FRONTDESK_TYPES)
  @ApiOperation({ summary: 'List all devices for a patient' })
  listPatientDevices(@Param('patientId') patientId: string) {
    return this.devices.listDevicesForPatient(patientId);
  }

  @Post('patient-devices/:id/approve')
  @AccountTypes(...FRONTDESK_TYPES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending patient device' })
  @ApiResponse({ status: 200, description: 'Device approved; push sent if FCM token present' })
  approveDevice(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.approveDevice(id, req.user.sub);
  }

  @Delete('patient-devices/:id')
  @AccountTypes(...FRONTDESK_TYPES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject/remove a device (patient must re-register and re-approve)',
  })
  rejectDevice(@Param('id') id: string) {
    return this.devices.rejectDevice(id);
  }

  @Get('patients/:parentId/children')
  @AccountTypes(...FRONTDESK_TYPES)
  @ApiOperation({ summary: 'List children linked to a parent patient' })
  listChildren(@Param('parentId') parentId: string) {
    return this.family.listChildren(parentId);
  }

  @Post('patients/:parentId/children')
  @AccountTypes(...FRONTDESK_TYPES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a child patient to a parent' })
  linkChild(
    @Param('parentId') parentId: string,
    @Body() dto: LinkChildDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.family.linkChild(parentId, dto, req.user.sub);
  }

  @Delete('patients/:parentId/children/:childId')
  @AccountTypes(...FRONTDESK_TYPES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink a child from a parent' })
  unlinkChild(
    @Param('parentId') parentId: string,
    @Param('childId') childId: string,
  ) {
    return this.family.unlinkChild(parentId, childId);
  }
}
