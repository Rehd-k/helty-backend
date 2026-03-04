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
import { ImagingRequestService } from './imaging-request.service';
import { CreateImagingRequestDto, UpdateImagingRequestDto } from './dto/create-imaging-request.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Imaging Request')
@Controller('imaging-requests')
export class ImagingRequestController {
  constructor(private readonly imagingRequestService: ImagingRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an imaging request (order) for an encounter' })
  create(@Body() dto: CreateImagingRequestDto) {
    return this.imagingRequestService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all imaging requests with optional filters' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '20',
    @Query('encounterId') encounterId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.imagingRequestService.findAll(
      parseInt(skip, 10),
      parseInt(take, 10),
      encounterId,
      patientId,
    );
  }

  @Get('encounter/:encounterId')
  @ApiOperation({ summary: 'Get all imaging requests for an encounter' })
  findByEncounterId(@Param('encounterId') encounterId: string) {
    return this.imagingRequestService.findByEncounterId(encounterId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get imaging request by ID' })
  findOne(@Param('id') id: string) {
    return this.imagingRequestService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update imaging request (e.g. status)' })
  update(@Param('id') id: string, @Body() dto: UpdateImagingRequestDto) {
    return this.imagingRequestService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete imaging request' })
  remove(@Param('id') id: string) {
    return this.imagingRequestService.remove(id);
  }
}
