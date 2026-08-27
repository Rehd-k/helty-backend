import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { WardRoundNotesService } from './ward-round-notes.service';
import { CreateWardRoundNoteDto } from './dto/create-ward-round-note.dto';
import { UpdateWardRoundNoteDto } from './dto/update-ward-round-note.dto';
import { ListWardRoundNotesQueryDto } from './dto/list-ward-round-notes-query.dto';

type ReqUser = { user: { sub: string } };

@ApiTags('Ward round notes')
@Controller('ward-round-notes')
@UseGuards(JwtAuthGuard, AccessGuard)
export class WardRoundNotesController {
  constructor(private readonly wardRoundNotesService: WardRoundNotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'Create a ward round (progress) note' })
  create(@Body() dto: CreateWardRoundNoteDto, @Req() req: ReqUser) {
    return this.wardRoundNotesService.create(dto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List ward round notes for an admission' })
  findAll(@Query() query: ListWardRoundNotesQueryDto) {
    return this.wardRoundNotesService.findAll(query);
  }

  @Patch(':id')
  @AccountTypes('INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'Update a ward round (progress) note' })
  @ApiParam({ name: 'id', description: 'Ward round note ID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWardRoundNoteDto,
    @Req() req: ReqUser,
  ) {
    return this.wardRoundNotesService.update(id, dto, req.user.sub);
  }
}
