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
import { LabTestFieldService } from './lab-test-field.service';
import { CreateLabTestFieldDto } from './dto/create-lab-test-field.dto';

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
  @ApiOperation({ summary: 'List fields for a test version (by position)' })
  findAllByVersionId(@Param('versionId') versionId: string) {
    return this.labTestFieldService.findAllByVersionId(versionId);
  }
}
