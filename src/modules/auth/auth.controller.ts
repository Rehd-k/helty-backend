import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Get,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from 'src/common/decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff login with email or phone and password' })
  @ApiResponse({ status: 200, description: 'Returns JWT access token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    try {
      const user = await this.authService.validateUser(
        dto.emailOrPhone,
        dto.password,
      );
      if (!user) {
        throw new BadRequestException(
          'Invalid email, phone number, or password',
        );
      }
      return this.authService.login(user);
    } catch (err) {
      throw err;
    }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Request a 6-digit password reset code (emailed when SMTP is set; otherwise stored for admin relay)',
  })
  @ApiResponse({
    status: 200,
    description: 'Generic confirmation (no email enumeration)',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestForgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Set a new password using the 6-digit code (from email or administrator)',
  })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordWithCode(
      dto.email,
      dto.code,
      dto.newPassword,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user info' })
  @ApiResponse({ status: 200, description: 'User information' })
  async me(@Body() body: any, @Request() req: any) {
    // JWT strategy already populates req.user
    return req.user;
  }
}
