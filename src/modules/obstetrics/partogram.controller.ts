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
import { PartogramService } from './partogram.service';
import { CreatePartogramEntryDto } from './dto/create-partogram-entry.dto';

@ApiTags('Obstetrics - Labour & delivery')
@Controller('obstetrics')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
export class PartogramController {
  constructor(private readonly partogramService: PartogramService) {}

  @Post('labour-deliveries/:id/partogram')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a partogram entry' })
  create(
    @Param('id') labourDeliveryId: string,
    @Body() dto: Omit<CreatePartogramEntryDto, 'labourDeliveryId'>,
  ) {
    return this.partogramService.create({ ...dto, labourDeliveryId });
  }

  @Get('labour-deliveries/:id/partogram')
  @ApiOperation({ summary: 'List partogram entries for a labour/delivery' })
  findByLabourDelivery(@Param('id') labourDeliveryId: string) {
    return this.partogramService.findByLabourDelivery(labourDeliveryId);
  }
}
