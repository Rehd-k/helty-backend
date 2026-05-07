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
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { DiscountService } from './discount.service';
import {
  CreateDiscountPolicyDto,
  QueryDiscountPolicyDto,
  UpdateDiscountPolicyDto,
} from './dto/discount-policy.dto';

@ApiTags('Discount Policies')
@Controller('discount-policies')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Get()
  @ApiOperation({ summary: 'List discount policies (for billing dropdown and admin view)' })
  @AccountTypes('BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  findAll(@Query() query: QueryDiscountPolicyDto) {
    return this.discountService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discount policy by id' })
  @ApiParam({ name: 'id', description: 'DiscountPolicy UUID' })
  @AccountTypes('BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.discountService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a discount policy (CMD/CMAC/SUPER_ADMIN)' })
  @AccountTypes('CMD', 'CMAC', 'SUPER_ADMIN')
  create(@Body() dto: CreateDiscountPolicyDto, @Req() req: any) {
    return this.discountService.create(dto, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a discount policy (CMD/CMAC/SUPER_ADMIN)' })
  @ApiParam({ name: 'id', description: 'DiscountPolicy UUID' })
  @AccountTypes('CMD', 'CMAC', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateDiscountPolicyDto, @Req() req: any) {
    return this.discountService.update(id, dto, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a discount policy (only if unused)' })
  @ApiParam({ name: 'id', description: 'DiscountPolicy UUID' })
  @AccountTypes('CMD', 'CMAC', 'SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.discountService.remove(id);
  }
}

