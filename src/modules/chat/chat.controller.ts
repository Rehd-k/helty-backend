import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('online-users')
  @ApiOperation({
    summary: 'List currently online users (staff with active chat connection)',
  })
  @ApiResponse({ status: 200, description: 'Array of online user info' })
  getOnlineUsers() {
    return this.chatService.getOnlineUsers();
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations (stub for future persistence)' })
  @ApiResponse({
    status: 200,
    description: 'Empty array until history is persisted',
  })
  getConversations(): [] {
    return [];
  }
}
