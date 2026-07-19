import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AccountTypes,
  AllowPendingDevice,
  Public,
} from '../../common/decorators';
import { PatientLoginDto } from './dto/patient-login.dto';
import { PATIENT_ACCOUNT_TYPE } from './patient-auth.constants';
import { PatientAuthService, PatientJwtPayload } from './patient-auth.service';

@ApiTags('patient-portal')
@Controller('patient-auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Patient login with patient ID, DOB, and deviceKey (creates PENDING device on first use)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns JWT access token, patient profile, and device status',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  @ApiResponse({
    status: 409,
    description: 'Device already registered to another patient',
  })
  login(@Body() dto: PatientLoginDto) {
    return this.patientAuthService.login(dto);
  }

  @Get('me')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @AllowPendingDevice()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated patient profile and device status' })
  @ApiResponse({ status: 200, description: 'Current patient profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Staff token cannot access patient routes' })
  me(@Request() req: { user: PatientJwtPayload }) {
    return this.patientAuthService.getMe(req.user);
  }

  @Post('logout')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @AllowPendingDevice()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Logout this device (deletes the device registration; re-login requires frontdesk approval)',
  })
  @ApiResponse({ status: 204, description: 'Logged out' })
  logout(@Request() req: { user: PatientJwtPayload }) {
    return this.patientAuthService.logout(req.user);
  }
}
