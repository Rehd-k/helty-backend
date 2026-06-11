import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { INPATIENT_NURSING_READ_ACCESS, INPATIENT_NURSING_WRITE_ACCESS, NURSING_ASSIGNMENT_WITH_DOCTORS } from '../nursing/nursing.constants';
import { MedicationAdministrationService } from './medication-administration.service';
import {
  CreateMedicationAdministrationDto,
  UpdateMedicationAdministrationDto,
} from './dto/admission-medication.dto';

@ApiTags('Inpatient — medication administrations')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
@Controller('admissions/:admissionId/medication-administrations')
export class MedicationAdministrationController {
  constructor(private readonly service: MedicationAdministrationService) { }

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'List medication administrations for an admission' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...INPATIENT_NURSING_WRITE_ACCESS)
  @ApiOperation({
    summary:
      'Record a medication administration (nurse; nurse resolved from JWT)',
  })
  async create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateMedicationAdministrationDto,
    @Req() req: { user: { sub: string } },
  ) {
    console.log(dto);
    const addmi = await this.service.create(admissionId, dto, req.user.sub);
    return addmi;
  }

  @Patch(':administrationId')
  @AccountTypes(...INPATIENT_NURSING_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update an administration (same nurse only)' })
  update(
    @Param('admissionId') admissionId: string,
    @Param('administrationId') administrationId: string,
    @Body() dto: UpdateMedicationAdministrationDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(
      admissionId,
      administrationId,
      dto,
      req.user.sub,
    );
  }
}
