import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PharmacyDrugInteractionService } from './pharmacy.drug-interaction.service';
import { CreateDrugInteractionDto } from './dto/drug-interaction.dto';

@ApiTags('Pharmacy - Drug Interactions')
@Controller('pharmacy/drug-interactions')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyDrugInteractionController {
  constructor(private readonly service: PharmacyDrugInteractionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a drug interaction' })
  create(@Body() dto: CreateDrugInteractionDto) {
    return this.service.create(dto);
  }

  @Get('by-drug/:drugId')
  @ApiOperation({ summary: 'Get interactions for a specific drug' })
  findByDrug(@Param('drugId') drugId: string) {
    return this.service.findByDrugId(drugId);
  }

  @Get()
  @ApiOperation({ summary: 'List all drug interactions (paginated)' })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.service.findAll(Number(skip) || 0, Number(take) || 50);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a drug interaction' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
