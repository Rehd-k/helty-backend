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
import { LabAntibioticService } from './lab-antibiotic.service';
import { CreateLabAntibioticDto } from './dto/create-lab-antibiotic.dto';
import { UpdateLabAntibioticDto } from './dto/update-lab-antibiotic.dto';

@ApiTags('Lab – Antibiotics (config)')
@Controller('lab/antibiotics')
export class LabAntibioticController {
  constructor(private readonly labAntibioticService: LabAntibioticService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an antibiotic to the AST panel catalog' })
  create(@Body() dto: CreateLabAntibioticDto) {
    return this.labAntibioticService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List configured antibiotics' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'When true, return only active antibiotics (for result entry)',
  })
  findAll(
    @Query('activeOnly') activeOnly?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.labAntibioticService.findAll(
      activeOnly === 'true',
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 200,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get antibiotic by ID' })
  findOne(@Param('id') id: string) {
    return this.labAntibioticService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an antibiotic' })
  update(@Param('id') id: string, @Body() dto: UpdateLabAntibioticDto) {
    return this.labAntibioticService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an antibiotic',
    description:
      'Fails if any AST results reference this antibiotic. Use isActive=false to retire instead.',
  })
  remove(@Param('id') id: string) {
    return this.labAntibioticService.remove(id);
  }
}
