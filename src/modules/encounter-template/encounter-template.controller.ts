import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { EncounterTemplateService } from './encounter-template.service';
import {
  CreateEncounterTemplateDto,
  QueryEncounterTemplateDto,
  UpdateEncounterTemplateDto,
} from './dto/encounter-template.dto';

@ApiTags('Encounter templates')
@Controller('encounter-templates')
export class EncounterTemplateController {
  constructor(
    private readonly encounterTemplateService: EncounterTemplateService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
  @ApiOperation({
    summary: 'Create a personal encounter template',
    description:
      'Saves reusable clinical prefill for the authenticated doctor. Template names must be unique per doctor.',
  })
  create(
    @Body() dto: CreateEncounterTemplateDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.encounterTemplateService.create(dto, req.user.sub);
  }

  @Get()
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
  @ApiOperation({
    summary: 'List encounter templates for the authenticated doctor',
  })
  findAll(
    @Query() query: QueryEncounterTemplateDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.encounterTemplateService.findAll(req.user.sub, query);
  }

  @Get(':id')
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
  @ApiOperation({ summary: 'Get one encounter template by id' })
  @ApiParam({ name: 'id', description: 'EncounterTemplate UUID' })
  findOne(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.encounterTemplateService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
  @ApiOperation({ summary: 'Update an encounter template' })
  @ApiParam({ name: 'id', description: 'EncounterTemplate UUID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEncounterTemplateDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.encounterTemplateService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
  @ApiOperation({ summary: 'Delete an encounter template' })
  @ApiParam({ name: 'id', description: 'EncounterTemplate UUID' })
  remove(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.encounterTemplateService.remove(id, req.user.sub);
  }
}
