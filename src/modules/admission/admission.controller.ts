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
  Req,
} from '@nestjs/common';
import { AdmissionService } from './admission.service';
import {
  CreateAdmissionDto,
  UpdateAdmissionDto,
} from './dto/create-admission.dto';
import { ListAdmissionsQueryDto } from './dto/list-admissions-query.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Admission')
@Controller('admissions')
export class AdmissionController {
  constructor(private readonly admissionService: AdmissionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new admission' })
  create(@Body() createAdmissionDto: CreateAdmissionDto, @Req() req: any) {
    return this.admissionService.create(createAdmissionDto, req);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all admissions (optional: status, attendingDoctorId)',
  })
  findAll(@Query() query: ListAdmissionsQueryDto) {
    const skip = Math.max(0, parseInt(query.skip ?? '0', 10) || 0);
    const take = Math.min(
      100,
      Math.max(1, parseInt(query.take ?? '10', 10) || 10),
    );
    return this.admissionService.findAll(skip, take, {
      status: query.status,
      attendingDoctorId: query.attendingDoctorId,
    });
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active (not discharged) admissions' })
  getActiveAdmissions() {
    return this.admissionService.getActiveAdmissions();
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get admissions for a specific patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.admissionService.findByPatientId(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admission by ID' })
  findOne(@Param('id') id: string) {
    return this.admissionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admission' })
  update(
    @Param('id') id: string,
    @Body() updateAdmissionDto: UpdateAdmissionDto,
  ) {
    return this.admissionService.update(id, updateAdmissionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete admission' })
  remove(@Param('id') id: string) {
    return this.admissionService.remove(id);
  }
}
