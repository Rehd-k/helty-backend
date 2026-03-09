import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { WardRoundNotesService } from './ward-round-notes.service';
import { CreateWardRoundNoteDto } from './dto/create-ward-round-note.dto';
import { ListWardRoundNotesQueryDto } from './dto/list-ward-round-notes-query.dto';

@ApiTags('Ward round notes')
@Controller('ward-round-notes')
@UseGuards(JwtAuthGuard, AccessGuard)
export class WardRoundNotesController {
  constructor(private readonly wardRoundNotesService: WardRoundNotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'Create a ward round (progress) note' })
  create(@Body() dto: CreateWardRoundNoteDto) {
    return this.wardRoundNotesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List ward round notes for an admission' })
  findAll(@Query() query: ListWardRoundNotesQueryDto) {
    return this.wardRoundNotesService.findAll(query);
  }
}
