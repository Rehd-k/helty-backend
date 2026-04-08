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
import { WaitingPatientService } from './waiting-patient.service';
import {
  CreateWaitingPatientDto,
  QueryWaitingPatientDto,
  SendToConsultingRoomDto,
  UpdateWaitingPatientDto,
} from './dto/waiting-patient.dto';

@ApiTags('Waiting Patients')
@Controller('waiting-patients')
export class WaitingPatientController {
  constructor(private readonly waitingPatientService: WaitingPatientService) {}

  @Post()
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary:
      'Deprecated: direct waiting-patient creation removed (use paid consultation invoices)',
  })
  create(@Body() dto: CreateWaitingPatientDto) {
    return this.waitingPatientService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List nursing queue from paid consultation invoices (registered patients only)',
  })
  findAll(@Query() query: QueryWaitingPatientDto) {
    return this.waitingPatientService.findAll(query);
  }

  @Get('consulting-room/:consultingRoomId')
  @ApiOperation({
    summary:
      'List invoice-backed waiting patients assigned to a specific consulting room',
  })
  @ApiParam({
    name: 'consultingRoomId',
    description: 'Consulting room UUID',
  })
  findByConsultingRoom(@Param('consultingRoomId') consultingRoomId: string) {
    return this.waitingPatientService.findByConsultingRoom(consultingRoomId);
  }

  @Post(':id/send-to-room')
  @ApiOperation({
    summary:
      'Assign consulting room on paid consultation invoice (vitals must already be linked)',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  sendToConsultingRoom(
    @Param('id') id: string,
    @Body() dto: SendToConsultingRoomDto,
  ) {
    return this.waitingPatientService.sendToConsultingRoom(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one invoice-backed queue entry by invoice ID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  findOne(@Param('id') id: string) {
    return this.waitingPatientService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update invoice-backed queue assignment (consulting room only; seen is encounter-driven)',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateWaitingPatientDto) {
    return this.waitingPatientService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ summary: 'Deprecated: queue rows are derived from invoices' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async remove(@Param('id') id: string) {
    await this.waitingPatientService.remove(id);
  }
}
