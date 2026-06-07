import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { HmoService } from './hmo.service';
import {
  CreateHmoDto,
  UpdateHmoDto,
  QueryHmoDto,
  QueryHmoPatientsDto,
  UpsertHmoServicePricesDto,
} from './dto/hmo.dto';

@ApiTags('HMO')
@Controller('hmos')
export class HmoController {
  constructor(private readonly hmoService: HmoService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an HMO',
    description:
      'Creates an HMO record and optional per-service pricing. Use GET /services to pick service IDs.',
  })
  @ApiCreatedResponse({ description: 'HMO created' })
  @ApiBadRequestResponse({ description: 'Validation or unknown service ids' })
  @AccountTypes('HMO', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  create(@Body() dto: CreateHmoDto, @Req() req: { user: { sub: string } }) {
    return this.hmoService.create(dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'List HMOs (paginated, searchable)' })
  @ApiOkResponse({ description: 'Paginated HMO list' })
  findAll(@Query() query: QueryHmoDto) {
    return this.hmoService.findAll(query);
  }

  @Get(':id/patients')
  @ApiOperation({
    summary: 'List patients registered under this HMO',
    description: 'Patients with patient.hmoId equal to this HMO id.',
  })
  @ApiParam({ name: 'id', description: 'HMO UUID' })
  @ApiOkResponse({ description: 'Paginated patients' })
  @ApiNotFoundResponse({ description: 'HMO not found' })
  findPatients(@Param('id') id: string, @Query() query: QueryHmoPatientsDto) {
    return this.hmoService.findPatients(id, query);
  }

  @Patch(':id/service-prices')
  @ApiOperation({
    summary: 'Upsert HMO service prices',
    description:
      'Creates or updates price rows for the given services. Prices for services not in the payload are kept unchanged.',
  })
  @ApiParam({ name: 'id', description: 'HMO UUID' })
  @ApiOkResponse({ description: 'Updated HMO with service prices' })
  @ApiNotFoundResponse({ description: 'HMO not found' })
  @AccountTypes('HMO', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  upsertServicePrices(
    @Param('id') id: string,
    @Body() dto: UpsertHmoServicePricesDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.hmoService.upsertServicePrices(id, dto, req);
  }

  @Delete(':id/service-prices/:serviceId')
  @ApiOperation({
    summary: 'Remove one HMO service price',
    description: 'Deletes the price row for a single service under this HMO.',
  })
  @ApiParam({ name: 'id', description: 'HMO UUID' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiOkResponse({ description: 'Price removed' })
  @ApiNotFoundResponse({ description: 'HMO or price row not found' })
  @AccountTypes('HMO', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  removeServicePrice(
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.hmoService.removeServicePrice(id, serviceId, req);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get HMO by id',
    description:
      'Includes service price rows with nested service details and patient count.',
  })
  @ApiParam({ name: 'id', description: 'HMO UUID' })
  @ApiOkResponse({ description: 'HMO detail' })
  @ApiNotFoundResponse({ description: 'HMO not found' })
  findOne(@Param('id') id: string) {
    return this.hmoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an HMO',
    description:
      'When servicePrices is sent, it replaces the full set of HMO service prices for this HMO.',
  })
  @ApiParam({ name: 'id', description: 'HMO UUID' })
  @ApiOkResponse({ description: 'Updated HMO' })
  @ApiNotFoundResponse({ description: 'HMO not found' })
  @AccountTypes('HMO', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHmoDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.hmoService.update(id, dto, req);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an HMO',
    description: 'Fails if any patient is linked to this HMO.',
  })
  @ApiParam({ name: 'id', description: 'HMO UUID' })
  @ApiOkResponse({ description: 'Deleted' })
  @ApiBadRequestResponse({ description: 'Patients still linked' })
  @AccountTypes('HMO', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.hmoService.remove(id);
  }
}
