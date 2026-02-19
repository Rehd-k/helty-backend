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
import { PatientService } from './patient.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';

@ApiTags('Patient')
@Controller('patients')
export class PatientController {
  constructor(
    private readonly patientService: PatientService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PatientController.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new patient' })
  @ApiResponse({
    status: 201,
    description: 'Patient created successfully',
  })
  create(@Body() createPatientDto: CreatePatientDto) {
    // avoid using console.log when pino is the app logger
    this.logger.debug('Creating patient with data', createPatientDto);
    return this.patientService.create(createPatientDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all patients with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of patients retrieved successfully',
  })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.patientService.findAll(parseInt(skip), parseInt(take));
  }

  @Get('search')
  @ApiOperation({ summary: 'Search patients by name, ID, email or phone' })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@Query('q') query: string) {
    return this.patientService.search(query);
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get complete patient medical history' })
  @ApiResponse({
    status: 200,
    description: 'Patient history retrieved',
  })
  getHistory(@Param('id') id: string) {
    return this.patientService.getPatientHistory(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({
    status: 200,
    description: 'Patient retrieved successfully',
  })
  findOne(@Param('id') id: string) {
    return this.patientService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient information' })
  @ApiResponse({
    status: 200,
    description: 'Patient updated successfully',
  })
  update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
  ) {
    return this.patientService.update(id, updatePatientDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a patient' })
  @ApiResponse({
    status: 204,
    description: 'Patient deleted successfully',
  })
  remove(@Param('id') id: string) {
    return this.patientService.remove(id);
  }
}
