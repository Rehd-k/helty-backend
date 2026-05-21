import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Icd10Service } from './icd10.service';
import { ListIcd10Dto } from './dto/list-icd10.dto';
import { SearchIcd10Dto } from './dto/search-icd10.dto';
import { Icd10GroupsQueryDto } from './dto/icd10-groups-query.dto';

@ApiTags('ICD-10')
@ApiBearerAuth()
@Controller('icd10')
export class Icd10Controller {
  constructor(private readonly icd10Service: Icd10Service) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search ICD-10 codes (autocomplete)',
    description:
      'Matches code prefix or description substring. Use for diagnosis pickers and typeahead.',
  })
  @ApiOkResponse({ description: 'Paginated search results' })
  search(@Query() query: SearchIcd10Dto) {
    return this.icd10Service.search(query);
  }

  @Get('specialties')
  @ApiOperation({ summary: 'List distinct clinical specialties' })
  @ApiOkResponse({ description: 'Specialty names from seeded ICD-10 data' })
  listSpecialties() {
    return this.icd10Service.listSpecialties();
  }

  @Get('groups')
  @ApiOperation({
    summary: 'List ICD groups for a specialty',
    description: 'Returns group name and code range per group.',
  })
  @ApiQuery({ name: 'specialty', required: true, type: String })
  @ApiOkResponse({ description: 'Groups for the given specialty' })
  listGroups(@Query() query: Icd10GroupsQueryDto) {
    return this.icd10Service.listGroups(query.specialty);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get a single ICD-10 code by code value' })
  @ApiParam({
    name: 'code',
    description: 'ICD-10 code (e.g. I00, I01.0). URL-encode dots if needed.',
    example: 'I00',
  })
  @ApiNotFoundResponse({ description: 'Code not found' })
  findByCode(@Param('code') code: string) {
    return this.icd10Service.findByCode(code);
  }

  @Get()
  @ApiOperation({
    summary: 'List ICD-10 codes with filters',
    description:
      'Paginated browse by specialty, group, range, and optional text filter.',
  })
  @ApiOkResponse({ description: 'Paginated list of ICD-10 codes' })
  findAll(@Query() query: ListIcd10Dto) {
    return this.icd10Service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ICD-10 code by database id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'Record not found' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.icd10Service.findById(id);
  }
}
