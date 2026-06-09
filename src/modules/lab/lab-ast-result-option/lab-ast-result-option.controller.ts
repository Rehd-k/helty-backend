import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LabAstResultOptionService } from './lab-ast-result-option.service';
import { CreateLabAstResultOptionDto } from './dto/create-lab-ast-result-option.dto';
import { UpdateLabAstResultOptionDto } from './dto/update-lab-ast-result-option.dto';

@ApiTags('Lab – AST result options (config)')
@Controller('lab/ast-result-options')
export class LabAstResultOptionController {
  constructor(
    private readonly labAstResultOptionService: LabAstResultOptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a susceptibility result option (e.g. Sensitive, Resistant)',
  })
  create(@Body() dto: CreateLabAstResultOptionDto) {
    return this.labAstResultOptionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List AST susceptibility result options' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'When true, return only active options (for result entry dropdowns)',
  })
  findAll(
    @Query('activeOnly') activeOnly?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.labAstResultOptionService.findAll(
      activeOnly === 'true',
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get AST result option by ID' })
  findOne(@Param('id') id: string) {
    return this.labAstResultOptionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an AST result option' })
  update(@Param('id') id: string, @Body() dto: UpdateLabAstResultOptionDto) {
    return this.labAstResultOptionService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an AST result option',
    description:
      'Fails if any AST results use this option. Use isActive=false to retire instead.',
  })
  remove(@Param('id') id: string) {
    return this.labAstResultOptionService.remove(id);
  }
}
