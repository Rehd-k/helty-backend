import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes, AllowPendingDevice } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { UpdateCurrentFcmTokenDto } from './dto/update-current-fcm-token.dto';
import { PatientDeviceService } from './patient-device.service';

@ApiTags('patient-portal')
@Controller('patient/devices')
export class PatientDeviceController {
  constructor(private readonly patientDeviceService: PatientDeviceService) {}

  @Get()
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered devices for the current patient' })
  @ApiResponse({ status: 200, description: 'Device list' })
  @ApiResponse({
    status: 403,
    description: 'DEVICE_PENDING_APPROVAL if device not yet approved',
  })
  list(@Request() req: { user: PatientJwtPayload }) {
    return this.patientDeviceService.listForPatient(req.user);
  }

  @Get('status')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @AllowPendingDevice()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current device approval status' })
  @ApiResponse({ status: 200, description: 'Current device status' })
  status(@Request() req: { user: PatientJwtPayload }) {
    return this.patientDeviceService.getCurrentStatus(req.user);
  }

  @Patch('current/fcm-token')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @AllowPendingDevice()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update FCM token for the current device (token refresh)',
  })
  @ApiResponse({ status: 200, description: 'FCM token updated' })
  updateFcmToken(
    @Request() req: { user: PatientJwtPayload },
    @Body() dto: UpdateCurrentFcmTokenDto,
  ) {
    return this.patientDeviceService.updateCurrentFcmToken(req.user, dto);
  }

  @Delete(':id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @AllowPendingDevice()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Remove a device (logout other device or self). Removed devices must be re-approved at frontdesk.',
  })
  @ApiResponse({ status: 200, description: 'Device removed' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  remove(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
  ) {
    return this.patientDeviceService.removeDevice(req.user, id);
  }
}
