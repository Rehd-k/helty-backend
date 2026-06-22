import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import {
  THEATRE_ACCESS,
  THEATRE_HEAD_ACCESS,
} from './theatre.constants';
import { TheatreRoomService } from './theatre-room.service';
import {
  CreateTheatreRoomDto,
  UpdateTheatreRoomDto,
} from './dto/theatre.dto';

@ApiTags('Theatre – Rooms')
@Controller('theatre/rooms')
@UseGuards(JwtAuthGuard, AccessGuard)
export class TheatreRoomController {
  constructor(private readonly theatreRoomService: TheatreRoomService) {}

  @Get()
  @AccountTypes(...THEATRE_ACCESS)
  @ApiOperation({ summary: 'List theatre rooms' })
  findAll() {
    return this.theatreRoomService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...THEATRE_HEAD_ACCESS)
  @ApiOperation({ summary: 'Create a theatre room' })
  create(@Body() dto: CreateTheatreRoomDto) {
    return this.theatreRoomService.create(dto);
  }

  @Patch(':id')
  @AccountTypes(...THEATRE_HEAD_ACCESS)
  @ApiOperation({ summary: 'Update a theatre room' })
  update(@Param('id') id: string, @Body() dto: UpdateTheatreRoomDto) {
    return this.theatreRoomService.update(id, dto);
  }
}
