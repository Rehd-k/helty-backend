import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../../common/guards';
import { SupportTicketService } from './support-ticket.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { PatchTicketStatusDto } from '../dto/patch-ticket-status.dto';
import { AssignTicketDto } from '../dto/assign-ticket.dto';
import { TicketMessageDto } from '../dto/ticket-message.dto';
import { SupportTicketStatus } from '@prisma/client';

@ApiTags('Support tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard, AccessGuard)
export class SupportTicketController {
  constructor(private readonly tickets: SupportTicketService) {}

  private staffId(req: { user?: { sub?: string } }): string {
    const id = req.user?.sub;
    if (!id) throw new BadRequestException('Missing user');
    return id;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a help ticket' })
  create(@Req() req: { user?: { sub?: string } }, @Body() dto: CreateTicketDto) {
    return this.tickets.create(this.staffId(req), dto.title);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets visible to current staff' })
  list(
    @Req() req: { user?: { sub?: string } },
    @Query('status') status?: SupportTicketStatus,
    @Query('assignedToMe') assignedToMe?: string,
  ) {
    return this.tickets.listForStaff(this.staffId(req), {
      status,
      assignedToMe: assignedToMe === '1' || assignedToMe === 'true',
    });
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List ticket thread messages' })
  listMessages(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.tickets.listMessages(id, this.staffId(req));
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a ticket message (REST)' })
  addMessage(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: TicketMessageDto,
  ) {
    return this.tickets.addMessage(
      id,
      this.staffId(req),
      dto.content,
      dto.fileUrl,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket with messages and audit log' })
  getOne(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.tickets.getByIdForStaff(id, this.staffId(req));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update ticket status' })
  patchStatus(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: PatchTicketStatusDto,
  ) {
    return this.tickets.patchStatus(id, this.staffId(req), dto.status);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign staff to ticket' })
  assign(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.tickets.assign(id, this.staffId(req), dto.staffId);
  }

  @Post(':id/unassign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove assignee' })
  unassign(
    @Req() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.tickets.unassign(id, this.staffId(req), dto.staffId);
  }
}
