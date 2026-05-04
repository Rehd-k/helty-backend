import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { WardService } from './ward.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Ward')
@ApiBearerAuth()
@Controller('wards')
export class WardController {
  constructor(private readonly wardService: WardService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ward' })
  createWard(@Body() dto: CreateWardDto) {
    return this.wardService.createWard(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all wards with beds' })
  findAllWards() {
    return this.wardService.findAllWards();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ward details, beds, and active inpatients' })
  findWardById(@Param('id') id: string) {
    return this.wardService.findWardById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ward details' })
  updateWard(@Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.wardService.updateWard(id, dto);
  }

  @Post(':wardId/beds')
  @ApiOperation({ summary: 'Create a bed in a ward' })
  createBed(
    @Param('wardId') wardId: string,
    @Body() dto: Omit<CreateBedDto, 'wardId'>,
  ) {
    return this.wardService.createBed({ ...dto, wardId });
  }

  @Get(':wardId/beds')
  @ApiOperation({ summary: 'List beds in a ward' })
  findBedsByWard(@Param('wardId') wardId: string) {
    return this.wardService.findBedsByWard(wardId);
  }

  @Patch('beds/:id')
  @ApiOperation({ summary: 'Update a bed' })
  updateBed(@Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.wardService.updateBed(id, dto);
  }
}
