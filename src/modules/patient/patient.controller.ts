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
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public, Roles } from '../../common/decorators';
import { PatientService } from './patient.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards';


@ApiTags('Patient')
@Controller('patients')
export class PatientController {
  private readonly log = new Logger(PatientController.name);
  constructor(
    private readonly patientService: PatientService
  ) {
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new patient' })
  @ApiResponse({
    status: 201,
    description: 'Patient created successfully',
  })
  create(@Body() createPatientDto: CreatePatientDto, @Req() req: any) {
    this.log.log('GET / called');
    // this.loggerService.info('req.user')s
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
    return this.patientService.findAll(parseInt(skip), parseInt(take), search, filterCategory, fromDate, toDate, sortBy, isAscending);
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
