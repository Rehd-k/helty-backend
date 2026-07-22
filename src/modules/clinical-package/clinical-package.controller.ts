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
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { ClinicalPackageService } from './clinical-package.service';
import {
  CreateClinicalServicePackageDto,
  ListClinicalServicePackagesQueryDto,
  UpdateClinicalServicePackageDto,
  UpsertClinicalServicePackageItemDto,
} from './dto/clinical-service-package.dto';
import { OBSTETRICS_PHYSICIAN_ACCESS } from '../obstetrics/obstetrics.constants';

@ApiTags('Clinical packages')
@Controller('clinical-packages')
export class ClinicalPackageController {
  constructor(private readonly clinicalPackageService: ClinicalPackageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'Create a clinical service package (admin)' })
  @ApiCreatedResponse({ description: 'Package created' })
  create(
    @Body() dto: CreateClinicalServicePackageDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clinicalPackageService.create(dto, req.user.sub);
  }

  @Get()
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'List clinical service packages (admin)' })
  findAll(@Query() query: ListClinicalServicePackagesQueryDto) {
    return this.clinicalPackageService.findAll(query);
  }

  @Get('default-antenatal')
  @AccountTypes(...OBSTETRICS_PHYSICIAN_ACCESS, 'SUPER_ADMIN', 'CMD', 'CMAC')
  @ApiOperation({
    summary: 'Default antenatal package with covered services and drugs',
  })
  @ApiOkResponse({ description: 'Active default antenatal package' })
  @ApiNotFoundResponse({ description: 'No default package configured' })
  getDefaultAntenatal() {
    return this.clinicalPackageService.getDefaultAntenatalPackage();
  }

  @Get(':id')
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'Get package by id (admin)' })
  @ApiParam({ name: 'id', description: 'Package UUID' })
  findOne(@Param('id') id: string) {
    return this.clinicalPackageService.findOne(id);
  }

  @Patch(':id')
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'Update package (admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicalServicePackageDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clinicalPackageService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'Delete package (admin)' })
  async remove(@Param('id') id: string) {
    await this.clinicalPackageService.remove(id);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'Add item to package (admin)' })
  addItem(
    @Param('id') packageId: string,
    @Body() dto: UpsertClinicalServicePackageItemDto,
  ) {
    return this.clinicalPackageService.addItem(packageId, dto);
  }

  @Patch(':id/items/:itemId')
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'Update package item (admin)' })
  updateItem(
    @Param('id') packageId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpsertClinicalServicePackageItemDto,
  ) {
    return this.clinicalPackageService.updateItem(packageId, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes('SUPER_ADMIN', 'CMD', 'CMAC', 'BILLING', 'BILLS')
  @ApiOperation({ summary: 'Remove package item (admin)' })
  async removeItem(
    @Param('id') packageId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.clinicalPackageService.removeItem(packageId, itemId);
  }
}
