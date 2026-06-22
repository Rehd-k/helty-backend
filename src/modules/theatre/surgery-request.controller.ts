import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { SURGERY_REQUEST_ACCESS, SURGERY_REQUEST_READ_ACCESS } from './theatre.constants';
import { SurgeryRequestService } from './surgery-request.service';
import {
  CreateSurgeryRequestDto,
  ListSurgeryRequestsQueryDto,
  UpdateSurgeryRequestDto,
} from './dto/create-surgery-request.dto';

@ApiTags('Surgery Requests')
@Controller('surgery-requests')
@UseGuards(JwtAuthGuard, AccessGuard)
export class SurgeryRequestController {
  constructor(
    private readonly surgeryRequestService: SurgeryRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...SURGERY_REQUEST_ACCESS)
  @ApiOperation({ summary: 'Book surgery from an encounter' })
  create(@Body() dto: CreateSurgeryRequestDto) {
    return this.surgeryRequestService.create(dto);
  }

  @Get()
  @AccountTypes(...SURGERY_REQUEST_READ_ACCESS)
  @ApiOperation({ summary: 'List surgery requests' })
  findAll(@Query() query: ListSurgeryRequestsQueryDto) {
    return this.surgeryRequestService.findAll(query);
  }

  @Get('encounter/:encounterId')
  @AccountTypes(...SURGERY_REQUEST_READ_ACCESS)
  @ApiOperation({ summary: 'List surgery requests for an encounter' })
  findByEncounter(@Param('encounterId') encounterId: string) {
    return this.surgeryRequestService.findByEncounterId(encounterId);
  }

  @Get(':id')
  @AccountTypes(...SURGERY_REQUEST_READ_ACCESS)
  @ApiOperation({ summary: 'Get surgery request by ID' })
  findOne(@Param('id') id: string) {
    return this.surgeryRequestService.findOne(id);
  }

  @Patch(':id')
  @AccountTypes(...SURGERY_REQUEST_ACCESS)
  @ApiOperation({ summary: 'Update or cancel a surgery request' })
  update(@Param('id') id: string, @Body() dto: UpdateSurgeryRequestDto) {
    return this.surgeryRequestService.update(id, dto);
  }
}
