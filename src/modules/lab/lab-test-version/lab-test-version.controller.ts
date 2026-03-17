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
import { LabTestVersionService } from './lab-test-version.service';
import { CreateLabTestVersionDto } from './dto/create-version.dto';

@ApiTags('Lab – Test Versions')
@Controller('lab/tests')
export class LabTestVersionController {
  constructor(private readonly labTestVersionService: LabTestVersionService) {}

  @Post(':testId/version')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new test version (optionally set as active)',
  })
  create(
    @Param('testId') testId: string,
    @Body() dto: CreateLabTestVersionDto,
  ) {
    return this.labTestVersionService.create(testId, dto);
  }

  @Get(':testId/versions')
  @ApiOperation({ summary: 'List versions for a test' })
  findAllByTestId(@Param('testId') testId: string) {
    return this.labTestVersionService.findAllByTestId(testId);
  }
}
