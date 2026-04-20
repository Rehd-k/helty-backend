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
        throw new BadRequestException('Invalid email, phone number, or password');
      }
      return this.authService.login(user);
    } catch (err) {
      throw err;
    }
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user info' })
  @ApiResponse({ status: 200, description: 'User information' })
  async me(@Body() body: any, @Request() req: any) {
    // JWT strategy already populates req.user
    return req.user;
  }
}
