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
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto, UpdatePrescriptionDto } from './dto/create-prescription.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Prescription')
@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new prescription' })
  create(@Body() createPrescriptionDto: CreatePrescriptionDto) {
    return this.prescriptionService.create(createPrescriptionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all prescriptions' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.prescriptionService.findAll(parseInt(skip), parseInt(take));
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all prescriptions for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.prescriptionService.findByPatientId(patientId);
  }

  @Get('patient/:patientId/active')
  @ApiOperation({ summary: 'Get active prescriptions for a patient' })
  getActivePrescriptions(@Param('patientId') patientId: string) {
    return this.prescriptionService.getActivePrescriptions(patientId);
  }

  @Get('encounter/:encounterId')
  @ApiOperation({ summary: 'Get all prescriptions for an encounter' })
  findByEncounterId(@Param('encounterId') encounterId: string) {
    return this.prescriptionService.findByEncounterId(encounterId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prescription by ID' })
  findOne(@Param('id') id: string) {
    return this.prescriptionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update prescription' })
  update(
    @Param('id') id: string,
    @Body() updatePrescriptionDto: UpdatePrescriptionDto,
  ) {
    return this.prescriptionService.update(id, updatePrescriptionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete prescription' })
  remove(@Param('id') id: string) {
    return this.prescriptionService.remove(id);
  }
}
