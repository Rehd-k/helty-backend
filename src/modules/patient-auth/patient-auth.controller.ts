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
import { PatientActivatePasswordDto, PatientActivateRequestDto, PatientActivateVerifyDto } from './dto/patient-activate.dto';
import { PatientForgotPasswordRequestDto, PatientForgotPasswordResetDto } from './dto/patient-forgot-password.dto';
import { PatientLoginDto } from './dto/patient-login.dto';
import { PatientRefreshDto } from './dto/patient-refresh.dto';
import { PATIENT_ACCOUNT_TYPE } from './patient-auth.constants';
import { PatientAuthService, PatientJwtPayload } from './patient-auth.service';

@ApiTags('patient-portal')
@Controller('patient-auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Public()
  @Post('activate/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start activation when phone and date of birth match the patient file',
  })
  @ApiResponse({ status: 200, description: 'Code issued. Delivery is staff, phone, or both.' })
  @ApiResponse({ status: 400, description: 'Phone or date of birth does not match' })
  @ApiResponse({ status: 409, description: 'Account already has a password' })
  requestActivation(@Body() dto: PatientActivateRequestDto) {
    return this.patientAuthService.requestActivation(dto);
  }

  @Public()
  @Post('activate/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check the activation code and return a short-lived setup token' })
  verifyActivation(@Body() dto: PatientActivateVerifyDto) {
    return this.patientAuthService.verifyActivation(dto);
  }

  @Public()
  @Post('activate/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the portal password and open a session' })
  completeActivation(@Body() dto: PatientActivatePasswordDto) {
    return this.patientAuthService.completeActivation(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Patient login with phone number and password',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns JWT access token, refresh token, patient profile, and device',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials or account not activated' })
  login(@Body() dto: PatientLoginDto) {
    return this.patientAuthService.login(dto);
  }

  @Public()
  @Post('forgot-password/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a reset code when phone and date of birth match an activated account' })
  requestPasswordReset(@Body() dto: PatientForgotPasswordRequestDto) {
    return this.patientAuthService.requestPasswordReset(dto);
  }

  @Public()
  @Post('forgot-password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace the password with a valid reset code and open a session' })
  resetPassword(@Body() dto: PatientForgotPasswordResetDto) {
    return this.patientAuthService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiResponse({ status: 401, description: 'Refresh token missing, expired, or revoked' })
  refresh(@Body() dto: PatientRefreshDto) {
    return this.patientAuthService.refresh(dto);
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
    summary: 'End this session. The device stays registered so the next sign-in does not wait for approval.',
  })
  @ApiResponse({ status: 204, description: 'Logged out' })
  logout(@Request() req: { user: PatientJwtPayload }) {
    return this.patientAuthService.logout(req.user);
  }
}
