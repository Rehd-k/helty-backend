import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Req,
  Query,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { Public } from '../../common/decorators';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';

@ApiTags('Staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new staff member' })
  @ApiResponse({ status: 201, description: 'Staff created' })
  create(@Body() dto: CreateStaffDto, @Req() req: any) {
    const { departmentId, wardId, role, ...rest } = dto;
    const data: any = { ...rest };
    if (departmentId) {
      data.department = { connect: { id: departmentId } };
    }
    if (wardId) {
      data.ward = { connect: { id: wardId } };
    }
    if (req && req.user && req.user.sub) {
      data.createdBy = { connect: { id: req.user.sub } };
    }
    data.staffRole = dto.staffRole ?? role;

    return this.staffService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'List all staff' })
  @ApiQuery({ name: 'q', required: false, description: 'Search staff by name, ID, email, department, account type, or role' })
  @ApiQuery({ name: 'accountType', required: false, enum: AccountType, description: 'Filter by account type (e.g. PHYSICIAN, NURSE)' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active/inactive staff' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default 20, max 500)' })
  @ApiResponse({ status: 200, description: 'Staff list returned' })
  findAll(@Query() query: ListStaffQueryDto) {
    return this.staffService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff member by ID' })
  @ApiResponse({ status: 200, description: 'Staff member returned' })
  async findOne(@Param('id') id: string) {
    const staff = await this.staffService.findById(id);
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    return staff;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a staff member' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @Req() req: { user: { sub: string } },
  ) {
    const { departmentId, wardId, role, staffRole, ...rest } = dto as UpdateStaffDto & {
      role?: string;
    };
    const data: any = { ...rest };
    if (departmentId) {
      data.department = { connect: { id: departmentId } };
    }
    if (wardId) {
      data.ward = { connect: { id: wardId } };
    }
    const resolvedRole = staffRole ?? role;
    if (resolvedRole !== undefined) {
      data.staffRole = resolvedRole;
    }
    return this.staffService.update(id, data, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a staff member' })
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
