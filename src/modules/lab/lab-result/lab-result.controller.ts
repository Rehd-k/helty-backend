import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabResultService } from './lab-result.service';
import { CreateLabResultDto } from './dto/create-lab-result.dto';
import { CreateLabResultBatchDto } from './dto/create-lab-result-batch.dto';

@ApiTags('Lab – Results')
@Controller('lab/results')
export class LabResultController {
  constructor(private readonly labResultService: LabResultService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a single result' })
  create(@Body() dto: CreateLabResultDto) {
    return this.labResultService.create(dto);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update multiple results for one order item' })
  createBatch(@Body() dto: CreateLabResultBatchDto) {
    return this.labResultService.createBatch(dto);
  }

  @Get(':orderItemId')
  @ApiOperation({ summary: 'Get all results for an order item' })
  findAllByOrderItemId(@Param('orderItemId') orderItemId: string) {
    return this.labResultService.findAllByOrderItemId(orderItemId);
  }
}
