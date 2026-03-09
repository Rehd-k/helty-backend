import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabSampleService } from './lab-sample.service';
import { CreateLabSampleDto } from './dto/create-lab-sample.dto';

@ApiTags('Lab – Samples')
@Controller('lab/samples')
export class LabSampleController {
  constructor(private readonly labSampleService: LabSampleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record sample collection for an order item' })
  create(@Body() dto: CreateLabSampleDto) {
    return this.labSampleService.create(dto);
  }
}
