import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { LabTestFieldService } from './lab-test-field.service';
import { CreateLabTestFieldDto } from './dto/create-lab-test-field.dto';
import { UpdateLabTestFieldDto } from './dto/update-lab-test-field.dto';

@ApiTags('Lab – Test Fields')
@Controller('lab/test-fields')
export class LabTestFieldController {
  constructor(private readonly labTestFieldService: LabTestFieldService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a test field' })
  create(@Body() dto: CreateLabTestFieldDto) {
    return this.labTestFieldService.create(dto);
  }

  @Get(':versionId')
  @ApiOperation({
    summary: 'List fields for a test version (by position)',
    description: 'Path parameter is the lab test version UUID, not a field id.',
  })
  @ApiParam({ name: 'versionId', description: 'Lab test version UUID' })
  findAllByVersionId(@Param('versionId') versionId: string) {
    return this.labTestFieldService.findAllByVersionId(versionId);
  }

  @Patch('/field/:id')
  @ApiOperation({
    summary: 'Update a test field',
    description: 'Path parameter is the lab test field UUID.',
  })
  @ApiParam({ name: 'id', description: 'Lab test field UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateLabTestFieldDto) {
    return this.labTestFieldService.update(id, dto);
  }

  @Delete('/field/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a test field',
    description: 'Path parameter is the lab test field UUID.',
  })
  @ApiParam({ name: 'id', description: 'Lab test field UUID' })
  remove(@Param('id') id: string) {
    return this.labTestFieldService.remove(id);
  }
}
