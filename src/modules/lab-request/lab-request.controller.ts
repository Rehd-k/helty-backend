import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LabRequestService } from './lab-request.service';
import { CreateLabRequestDto, UpdateLabRequestDto } from './dto/create-lab-request.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Lab Request')
@Controller('lab-requests')
export class LabRequestController {
  constructor(private readonly labRequestService: LabRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lab request (order) for an encounter' })
  create(@Body() dto: CreateLabRequestDto) {
    return this.labRequestService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lab requests with optional filters' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '20',
    @Query('encounterId') encounterId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.labRequestService.findAll(
      parseInt(skip, 10),
      parseInt(take, 10),
      encounterId,
      patientId,
    );
  }

  @Get('encounter/:encounterId')
  @ApiOperation({ summary: 'Get all lab requests for an encounter' })
  findByEncounterId(@Param('encounterId') encounterId: string) {
    return this.labRequestService.findByEncounterId(encounterId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab request by ID' })
  findOne(@Param('id') id: string) {
    return this.labRequestService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lab request (e.g. status)' })
  update(@Param('id') id: string, @Body() dto: UpdateLabRequestDto) {
    return this.labRequestService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete lab request' })
  remove(@Param('id') id: string) {
    return this.labRequestService.remove(id);
  }
}
