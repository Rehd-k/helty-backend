import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { nanoid } from 'nanoid';
import type { Response } from 'express';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ChatService } from './chat.service';
import { PresenceService } from './presence/presence.service';
import { StaffConversationService } from './conversation/staff-conversation.service';
import { StaffConversationMessageService } from './message/staff-conversation-message.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import { RenameGroupDto } from './dto/rename-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { PromoteAdminDto } from './dto/promote-admin.dto';
import { MarkConversationReadDto } from './dto/mark-conversation-read.dto';
import { SendConversationMessageRestDto } from './dto/send-conversation-message-rest.dto';
import { ConfigService } from '@nestjs/config';

const CHAT_UPLOAD_SUB = 'chat';
const TICKET_UPLOAD_SUB = 'tickets';

const ALLOWED_CHAT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function uploadsRoot() {
  return path.join(process.cwd(), 'uploads');
}

function safeResolveUnderUploads(relativePath: string): string {
  const base = uploadsRoot();
  const normalized = path.normalize(path.join(base, relativePath));
  if (!normalized.startsWith(base)) {
    throw new BadRequestException('Invalid file path');
  }
  return normalized;
}

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly presence: PresenceService,
    private readonly conversations: StaffConversationService,
    private readonly messages: StaffConversationMessageService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private staffId(req: { user?: { sub?: string } }): string {
    const id = req.user?.sub;
    if (!id) throw new BadRequestException('Missing user');
    return id;
  }

  @Get('online-users')
  @ApiOperation({
    summary: 'List staff with at least one active WebSocket (same as legacy)',
  })
  @ApiResponse({ status: 200 })
  getOnlineUsers() {
    return this.chatService.getOnlineUsers();
  }

  @Get('presence/roster')
  @ApiOperation({ summary: 'Staff ids with Redis online presence' })
  async presenceRoster() {
    const ids = await this.presence.getOnlineStaffIds();
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
      },
    });
    const presence = await Promise.all(
      ids.map(async (id) => ({
        staffId: id,
        ...(await this.presence.getPresence(id)),
      })),
    );
    return { staff, presence };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations for current staff' })
  listConversations(@Req() req: { user?: { sub?: string } }) {
    return this.conversations.listForStaff(this.staffId(req));
  }

  @Post('conversations/direct')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Get or create a direct conversation' })
  createDirect(
    @Req() req: { user?: { sub?: string } },
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.conversations.getOrCreateDirect(
      this.staffId(req),
      dto.otherStaffId,
    );
  }

  @Post('conversations/group')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a group conversation' })
  createGroup(
    @Req() req: { user?: { sub?: string } },
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.conversations.createGroup(
      this.staffId(req),
      dto.name,
      dto.memberStaffIds,
    );
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation details' })
  getConversation(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.conversations.getOne(id, this.staffId(req));
  }

  @Patch('conversations/:id/rename')
  @ApiOperation({ summary: 'Rename a group (admin)' })
  renameGroup(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: RenameGroupDto,
  ) {
    return this.conversations.renameGroup(id, this.staffId(req), dto.name);
  }

  @Post('conversations/:id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add member to group (admin)' })
  addMember(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.conversations.addMember(id, this.staffId(req), dto.staffId);
  }

  @Delete('conversations/:id/members/:staffId')
  @ApiOperation({ summary: 'Remove member from group (admin)' })
  removeMember(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Param('staffId') targetStaffId: string,
  ) {
    return this.conversations.removeMember(
      id,
      this.staffId(req),
      targetStaffId,
    );
  }

  @Post('conversations/:id/admins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Promote member to admin (admin)' })
  promoteAdmin(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: PromoteAdminDto,
  ) {
    return this.conversations.promoteAdmin(
      id,
      this.staffId(req),
      dto.staffId,
    );
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Paginated messages (cursor = message id)' })
  listMessages(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.listMessages(
      id,
      this.staffId(req),
      limit ? parseInt(limit, 10) : 30,
      cursor,
    );
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message via REST' })
  sendMessageRest(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: SendConversationMessageRestDto,
  ) {
    return this.messages.send(id, this.staffId(req), {
      content: dto.content,
      type: dto.type,
      fileUrl: dto.fileUrl,
    });
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark messages read up to a message id' })
  markRead(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: MarkConversationReadDto,
  ) {
    return this.messages.markReadUpTo(
      id,
      this.staffId(req),
      dto.lastReadMessageId,
    );
  }

  @Post('upload/conversation/:conversationId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const id = (req.params as { conversationId: string }).conversationId;
          const dir = path.join(uploadsRoot(), CHAT_UPLOAD_SUB, id);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname) || '.bin';
          cb(null, `${nanoid()}${ext}`);
        },
      }),
      limits: {
        fileSize: Number(process.env.CHAT_MAX_FILE_BYTES) || 52_428_800,
      },
      fileFilter: (_req, file, cb) => {
        const mime = file.mimetype?.toLowerCase();
        if (mime && ALLOWED_CHAT_MIMES.has(mime)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'File type not allowed for chat upload',
          ),
          false,
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload file for a conversation message' })
  async uploadConversationFile(
    @Req() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file required');
    await this.conversations.assertMember(conversationId, this.staffId(req));
    const relative = path.join(CHAT_UPLOAD_SUB, conversationId, file.filename);
    const base =
      this.config.get<string>('PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ?? '';
    const downloadUrl = `${base}/chat/files/conversation-message/by-path?path=${encodeURIComponent(relative.replace(/\\/g, '/'))}`;
    return {
      relativePath: relative.replace(/\\/g, '/'),
      fileUrl: relative.replace(/\\/g, '/'),
      downloadUrl,
    };
  }

  @Post('upload/ticket/:ticketId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const id = (req.params as { ticketId: string }).ticketId;
          const dir = path.join(uploadsRoot(), TICKET_UPLOAD_SUB, id);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname) || '.bin';
          cb(null, `${nanoid()}${ext}`);
        },
      }),
      limits: {
        fileSize: Number(process.env.CHAT_MAX_FILE_BYTES) || 52_428_800,
      },
      fileFilter: (_req, file, cb) => {
        const mime = file.mimetype?.toLowerCase();
        if (mime && ALLOWED_CHAT_MIMES.has(mime)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'File type not allowed for ticket upload',
          ),
          false,
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload file for a ticket message' })
  async uploadTicketFile(
    @Req() req: { user?: { sub?: string }; params: { ticketId: string } },
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file required');
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { assignments: { select: { staffId: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const sid = this.staffId(req);
    const ok =
      ticket.createdById === sid ||
      ticket.assignments.some((a) => a.staffId === sid);
    if (!ok) throw new BadRequestException('No access to this ticket');

    const relative = path.join(TICKET_UPLOAD_SUB, ticketId, file.filename);
    const base =
      this.config.get<string>('PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ?? '';
    const downloadUrl = `${base}/chat/files/ticket-message/by-path?path=${encodeURIComponent(relative.replace(/\\/g, '/'))}`;
    return {
      relativePath: relative.replace(/\\/g, '/'),
      fileUrl: relative.replace(/\\/g, '/'),
      downloadUrl,
    };
  }

  @Get('files/conversation-message/by-path')
  @ApiOperation({
    summary: 'Download by relative path (use after upload, before message exists)',
  })
  async downloadConversationFileByPath(
    @Req() req: { user?: { sub?: string } },
    @Query('path') rel: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!rel) throw new BadRequestException('path query required');
    const decoded = decodeURIComponent(rel).replace(/\\/g, '/');
    if (!decoded.startsWith(`${CHAT_UPLOAD_SUB}/`)) {
      throw new BadRequestException('Invalid path');
    }
    const conversationId = decoded.split('/')[1];
    if (!conversationId) throw new BadRequestException('Invalid path');
    await this.conversations.assertMember(conversationId, this.staffId(req));
    const abs = safeResolveUnderUploads(decoded);
    if (!fs.existsSync(abs)) throw new NotFoundException('File not found');
    res.sendFile(abs);
  }

  @Get('files/conversation-message/:messageId')
  @ApiOperation({ summary: 'Download file attached to a conversation message' })
  async downloadConversationFileByMessage(
    @Req() req: { user?: { sub?: string } },
    @Param('messageId') messageId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const msg = await this.prisma.staffConversationMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg?.fileUrl) throw new NotFoundException('Message or file not found');
    await this.conversations.assertMember(msg.conversationId, this.staffId(req));
    const rel = msg.fileUrl.replace(/\\/g, '/');
    if (!rel.startsWith(`${CHAT_UPLOAD_SUB}/`)) {
      throw new BadRequestException('Invalid stored path');
    }
    const abs = safeResolveUnderUploads(rel);
    if (!fs.existsSync(abs)) throw new NotFoundException('File not found');
    res.sendFile(abs);
  }

  @Get('files/ticket-message/by-path')
  @ApiOperation({ summary: 'Download ticket file by path (after upload)' })
  async downloadTicketFileByPath(
    @Req() req: { user?: { sub?: string } },
    @Query('path') rel: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    if (!rel) throw new BadRequestException('path query required');
    const decoded = decodeURIComponent(rel).replace(/\\/g, '/');
    if (!decoded.startsWith(`${TICKET_UPLOAD_SUB}/`)) {
      throw new BadRequestException('Invalid path');
    }
    const ticketId = decoded.split('/')[1];
    if (!ticketId) throw new BadRequestException('Invalid path');
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { assignments: { select: { staffId: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const sid = this.staffId(req);
    const ok =
      ticket.createdById === sid ||
      ticket.assignments.some((a) => a.staffId === sid);
    if (!ok) throw new BadRequestException('No access');
    const abs = safeResolveUnderUploads(decoded);
    if (!fs.existsSync(abs)) throw new NotFoundException('File not found');
    res.sendFile(abs);
  }

  @Get('files/ticket-message/:messageId')
  @ApiOperation({ summary: 'Download file attached to a ticket message' })
  async downloadTicketFileByMessage(
    @Req() req: { user?: { sub?: string } },
    @Param('messageId') messageId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const msg = await this.prisma.supportTicketMessage.findUnique({
      where: { id: messageId },
      include: {
        ticket: { include: { assignments: { select: { staffId: true } } } },
      },
    });
    if (!msg?.fileUrl) throw new NotFoundException('Message or file not found');
    const sid = this.staffId(req);
    const t = msg.ticket;
    const ok =
      t.createdById === sid || t.assignments.some((a) => a.staffId === sid);
    if (!ok) throw new BadRequestException('No access');
    const rel = msg.fileUrl.replace(/\\/g, '/');
    if (!rel.startsWith(`${TICKET_UPLOAD_SUB}/`)) {
      throw new BadRequestException('Invalid stored path');
    }
    const abs = safeResolveUnderUploads(rel);
    if (!fs.existsSync(abs)) throw new NotFoundException('File not found');
    res.sendFile(abs);
  }
}
