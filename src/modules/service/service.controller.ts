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
import { ServiceService } from './service.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';

@ApiTags('Service')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) { }

  @AccountTypes('STORE', 'DISPENSARY')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new hospital service' })
  create(@Body() createServiceDto: CreateServiceDto, @Req() req: any) {
    return this.serviceService.create(createServiceDto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Get all hospital services' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.serviceService.findAll(parseInt(skip), parseInt(take));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID' })
  findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update service information' })
  update(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.serviceService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service' })
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }

  @Post('patient/:patientId/service/:serviceId')
  @ApiOperation({ summary: 'Assign a service to a patient' })
  addServiceToPatient(
    @Param('patientId') patientId: string,
    @Param('serviceId') serviceId: string,
    @Body() body: { quantity?: number },
  ) {
    return this.serviceService.addServiceToPatient(
      patientId,
      serviceId,
      body.quantity || 1,
    );
  }

  @Get('patient/:patientId/services')
  @ApiOperation({ summary: 'Get all services assigned to a patient' })
  getPatientServices(@Param('patientId') patientId: string) {
    return this.serviceService.getPatientServices(patientId);
  }

  @Delete('patient-service/:patientServiceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a service from a patient' })
  removePatientService(@Param('patientServiceId') patientServiceId: string) {
    return this.serviceService.removePatientService(patientServiceId);
  }
}
