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
import { LabAstResultService } from './lab-ast-result.service';
import { CreateLabAstResultBatchDto } from './dto/create-lab-ast-result-batch.dto';

@ApiTags('Lab – AST results')
@Controller('lab/ast-results')
export class LabAstResultController {
  constructor(private readonly labAstResultService: LabAstResultService) {}

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or update AST susceptibility results for an order item',
    description:
      'Order item must have astRequested=true. Each antibiotic may appear once per order item.',
  })
  createBatch(@Body() dto: CreateLabAstResultBatchDto) {
    return this.labAstResultService.createBatch(dto);
  }

  @Get(':orderItemId')
  @ApiOperation({ summary: 'Get AST results for an order item' })
  findAllByOrderItemId(@Param('orderItemId') orderItemId: string) {
    return this.labAstResultService.findAllByOrderItemId(orderItemId);
  }
}
