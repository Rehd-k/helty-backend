import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseNoteDto } from './dto/create-purchase-note.dto';
import { ListPurchaseNotesQueryDto } from './dto/list-purchase-notes-query.dto';
import { UpdatePurchaseNoteStatusDto } from './dto/update-purchase-note-status.dto';

@ApiTags('Purchases')
@Controller('purchases')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Post('notes')
  @ApiOperation({ summary: 'Create a purchase note (from any department)' })
  create(@Body() dto: CreatePurchaseNoteDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get('notes')
  @ApiOperation({
    summary: 'List purchase notes with filtering and pagination',
  })
  findAll(@Query() query: ListPurchaseNotesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('notes/:id')
  @ApiOperation({ summary: 'Get purchase note by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('notes/:id/status')
  @ApiOperation({
    summary: 'Update purchase note status (e.g. approve, reject, complete)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseNoteStatusDto,
    @Req() req: any,
  ) {
    return this.service.updateStatus(id, dto.status, {
      toLocationId: dto.toLocationId,
      updatedById: req.user?.sub,
    });
  }
}
