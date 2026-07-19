import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { SendCustomPushDto } from './dto/send-custom-push.dto';
import { CustomPushService } from './custom-push.service';

@ApiTags('Notifications')
@Controller('notifications')
export class CustomPushController {
  constructor(private readonly customPushService: CustomPushService) {}

  @Post('custom')
  @AccountTypes('CMAC', 'CMD', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a custom FCM push to patients',
    description:
      'CMAC, CMD, and SUPER_ADMIN only. Targets all patients with a registered device, or only the given patientIds. Optional imageUrl must be publicly reachable.',
  })
  @ApiResponse({ status: 200, description: 'Push dispatch result' })
  @ApiResponse({ status: 401, description: 'Missing or invalid staff token' })
  @ApiResponse({
    status: 403,
    description: 'Requires CMAC, CMD, or SUPER_ADMIN',
  })
  sendCustom(
    @Body() dto: SendCustomPushDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.customPushService.send(req.user.sub, dto);
  }
}
