import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { OBSTETRICS_PHYSICIAN_ACCESS } from './obstetrics.constants';
import { PartogramService } from './partogram.service';
import { CreatePartogramEntryDto } from './dto/create-partogram-entry.dto';

@ApiTags('Obstetrics - Labour & delivery')
@Controller('obstetrics')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PartogramController {
  constructor(private readonly partogramService: PartogramService) {}

  @Post('labour-deliveries/:id/partogram')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...OBSTETRICS_PHYSICIAN_ACCESS)
  @ApiOperation({ summary: 'Add a partogram entry' })
  create(
    @Param('id') labourDeliveryId: string,
    @Body() dto: Omit<CreatePartogramEntryDto, 'labourDeliveryId'>,
  ) {
    return this.partogramService.create({ ...dto, labourDeliveryId });
  }

  @Get('labour-deliveries/:id/partogram')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'List partogram entries for a labour/delivery' })
  findByLabourDelivery(@Param('id') labourDeliveryId: string) {
    return this.partogramService.findByLabourDelivery(labourDeliveryId);
  }
}
