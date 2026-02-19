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
import { MedicalHistoryService } from './medical-history.service';
import { CreateMedicalHistoryDto, UpdateMedicalHistoryDto } from './dto/create-medical-history.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Medical History')
@Controller('medical-histories')
export class MedicalHistoryController {
  constructor(private readonly medicalHistoryService: MedicalHistoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add medical history entry' })
  create(@Body() createMedicalHistoryDto: CreateMedicalHistoryDto) {
    return this.medicalHistoryService.create(createMedicalHistoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all medical history entries' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.medicalHistoryService.findAll(parseInt(skip), parseInt(take));
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get medical history for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.medicalHistoryService.findByPatientId(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medical history entry by ID' })
  findOne(@Param('id') id: string) {
    return this.medicalHistoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update medical history entry' })
  update(
    @Param('id') id: string,
    @Body() updateMedicalHistoryDto: UpdateMedicalHistoryDto,
  ) {
    return this.medicalHistoryService.update(id, updateMedicalHistoryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete medical history entry' })
  remove(@Param('id') id: string) {
    return this.medicalHistoryService.remove(id);
  }
}
