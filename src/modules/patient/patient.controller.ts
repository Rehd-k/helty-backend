import {
  BadRequestException,
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
  Logger,
  Req,
} from '@nestjs/common';
import { Public, Roles } from '../../common/decorators';
import { PatientService } from './patient.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Patient')
@Controller('patients')
export class PatientController {
  private readonly log = new Logger(PatientController.name);
  constructor(private readonly patientService: PatientService) { }

  private applySelect<T extends Record<string, unknown>>(
    payload: T,
    select?: string,
  ): Partial<T> | T {
    if (!select?.trim()) return payload;

    const fields = select
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
    if (!fields.length) return payload;

    const allowedFields = Object.keys(payload);
    const invalidFields = fields.filter(
      (field) => !allowedFields.includes(field),
    );
    if (invalidFields.length > 0) {
      throw new BadRequestException(
        `Invalid select field(s): ${invalidFields.join(', ')}.`,
      );
    }

    return fields.reduce((acc, field) => {
      acc[field as keyof T] = payload[field as keyof T];
      return acc;
    }, {} as Partial<T>);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new patient' })
  @ApiResponse({
    status: 201,
    description: 'Patient created successfully',
  })
  create(@Body() createPatientDto: CreatePatientDto, @Req() req: any) {

    return this.patientService.create(createPatientDto, req);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all patients with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of patients retrieved successfully',
  })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
    @Query('q') search: string = '',
    @Query('filterCategory') filterCategory: string = '',
    @Query('fromDate') fromDate: string = '',
    @Query('toDate') toDate: string = '',
    @Query('sortBy') sortBy: string = '',
    @Query('isAscending') isAscending: boolean = true,
  ) {
    return this.patientService.findAll(
      parseInt(skip),
      parseInt(take),
      search,
      filterCategory,
      fromDate,
      toDate,
      sortBy,
      isAscending,
    );
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
  async findOne(@Param('id') id: string, @Query('select') select?: string) {
    const patient = await this.patientService.findOne(id);
    if (!patient) {
      return patient;
    }
    return this.applySelect(patient as Record<string, unknown>, select);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient information' })
  @ApiResponse({
    status: 200,
    description: 'Patient updated successfully',
  })
  update(@Param('id') id: string, @Body() updatePatientDto: any, @Req() req: any) {
    console.log(updatePatientDto);
    this.log.log('GET / called');
    return this.patientService.update(id, updatePatientDto, req);
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
