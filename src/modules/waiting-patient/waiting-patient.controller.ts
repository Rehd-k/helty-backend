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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a patient to the waiting list (not in a consulting room yet)',
  })
  create(@Body() dto: CreateWaitingPatientDto) {
    return this.waitingPatientService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List waiting patients with optional filters and pagination (use unassignedOnly to list those not yet sent to a room)',
  })
  findAll(@Query() query: QueryWaitingPatientDto) {
    return this.waitingPatientService.findAll(query);
  }

  @Get('consulting-room/:consultingRoomId')
  @ApiOperation({
    summary: 'List waiting patients for a specific consulting room',
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
      'Send a waiting patient to a consulting room (vitals must exist for the patient first)',
  })
  @ApiParam({ name: 'id', description: 'Waiting patient entry UUID' })
  sendToConsultingRoom(
    @Param('id') id: string,
    @Body() dto: SendToConsultingRoomDto,
  ) {
    return this.waitingPatientService.sendToConsultingRoom(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a waiting patient entry by ID' })
  @ApiParam({ name: 'id', description: 'Waiting patient UUID' })
  findOne(@Param('id') id: string) {
    return this.waitingPatientService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a waiting patient entry (e.g., assign or move to a room; vitals required before assigning a room)',
  })
  @ApiParam({ name: 'id', description: 'Waiting patient UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateWaitingPatientDto) {
    return this.waitingPatientService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a waiting patient entry' })
  @ApiParam({ name: 'id', description: 'Waiting patient UUID' })
  async remove(@Param('id') id: string) {
    await this.waitingPatientService.remove(id);
  }
}
