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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BankService } from './bank.service';
import { CreateBankDto, UpdateBankDto, QueryBankDto } from './dto/bank.dto';

@ApiTags('Bank')
@Controller('banks')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  // ─── POST /bank ───────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new bank account record' })
  create(@Body() dto: CreateBankDto, @Req() req: any) {
    return this.bankService.create(dto, req);
  }

  // ─── GET /bank ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all bank accounts (with optional search + pagination)',
  })
  findAll(@Query() query: QueryBankDto) {
    return this.bankService.findAll(query);
  }

  // ─── GET /bank/:id ────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bank account by ID' })
  @ApiParam({ name: 'id', description: 'Bank UUID' })
  findOne(@Param('id') id: string) {
    return this.bankService.findOne(id);
  }

  // ─── PATCH /bank/:id ──────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bank account record' })
  @ApiParam({ name: 'id', description: 'Bank UUID' })
  update(@Param('id') id: string, @Body() dto: UpdateBankDto, @Req() req: any) {
    return this.bankService.update(id, dto, req);
  }

  // ─── DELETE /bank/:id ─────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a bank account (only if it has no linked payments)',
  })
  @ApiParam({ name: 'id', description: 'Bank UUID' })
  remove(@Param('id') id: string) {
    return this.bankService.remove(id);
  }
}
