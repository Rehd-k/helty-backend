import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabTestService } from './lab-test.service';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';

@ApiTags('Lab – Tests')
@Controller('lab/tests')
export class LabTestController {
  constructor(private readonly labTestService: LabTestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lab test' })
  create(@Body() dto: CreateLabTestDto) {
    return this.labTestService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List lab tests with optional filters' })
  findAll(@Query() query: ListTestsQueryDto) {
    return this.labTestService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab test by ID' })
  findOne(@Param('id') id: string) {
    return this.labTestService.findOne(id);
  }
}
