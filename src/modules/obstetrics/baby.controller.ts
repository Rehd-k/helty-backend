import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { BabyService } from './baby.service';
import {
  CreateBabyDto,
  UpdateBabyDto,
  RegisterBabyAsPatientDto,
} from './dto/create-baby.dto';
import { ListBabiesQueryDto } from './dto/list-babies-query.dto';

@ApiTags('Obstetrics - Labour & delivery')
@Controller('obstetrics')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
export class BabyController {
  constructor(private readonly babyService: BabyService) {}

  @Post('labour-deliveries/:id/babies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a baby record for a delivery' })
  create(
    @Param('id') labourDeliveryId: string,
    @Body() dto: Omit<CreateBabyDto, 'labourDeliveryId'>,
    @Req() req: any,
  ) {
    return this.babyService.create(
      { ...dto, labourDeliveryId },
      dto.createdById ?? req.user?.sub,
    );
  }

  @Get('babies')
  @ApiOperation({
    summary: 'List babies (optional: motherId, labourDeliveryId)',
  })
  findAll(@Query() query: ListBabiesQueryDto) {
    return this.babyService.findAll(query);
  }

  @Get('babies/:id')
  @ApiOperation({ summary: 'Get baby by ID' })
  findOne(@Param('id') id: string) {
    return this.babyService.findOne(id);
  }

  @Patch('babies/:id')
  @ApiOperation({ summary: 'Update baby' })
  update(@Param('id') id: string, @Body() dto: UpdateBabyDto) {
    return this.babyService.update(id, dto);
  }

  @Post('babies/:id/register-patient')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register baby as a patient' })
  registerAsPatient(
    @Param('id') id: string,
    @Body() dto: RegisterBabyAsPatientDto,
    @Req() req: any,
  ) {
    return this.babyService.registerAsPatient(id, dto, req.user?.sub);
  }
}
