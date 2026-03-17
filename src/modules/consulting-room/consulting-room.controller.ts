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
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConsultingRoomService } from './consulting-room.service';
import {
  CreateConsultingRoomDto,
  QueryConsultingRoomDto,
  UpdateConsultingRoomDto,
} from './dto/consulting-room.dto';
import { Roles } from 'src/common/decorators';

@ApiTags('Consulting Rooms')
@Controller('consulting-rooms')
export class ConsultingRoomController {
  constructor(private readonly consultingRoomService: ConsultingRoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new consulting room' })
  create(@Body() dto: CreateConsultingRoomDto) {
    return this.consultingRoomService.create(dto);
  }

  @Roles('admin', 'doctor', 'nurse')
  @Get()
  @ApiOperation({
    summary: 'List consulting rooms with optional search and pagination',
  })
  findAll(@Query() query: QueryConsultingRoomDto) {
    return this.consultingRoomService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a consulting room by ID' })
  @ApiParam({ name: 'id', description: 'Consulting room UUID' })
  findOne(@Param('id') id: string) {
    return this.consultingRoomService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a consulting room' })
  @ApiParam({ name: 'id', description: 'Consulting room UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateConsultingRoomDto) {
    return this.consultingRoomService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a consulting room' })
  @ApiParam({ name: 'id', description: 'Consulting room UUID' })
  async remove(@Param('id') id: string) {
    await this.consultingRoomService.remove(id);
  }
}
