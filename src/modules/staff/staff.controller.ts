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
    UseGuards,
    NotFoundException,
    Req,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards';
import { Public } from 'src/common/decorators';

// @UseGuards(JwtAuthGuard)
@ApiTags('Staff')
@Controller('staff')
export class StaffController {
    constructor(private readonly staffService: StaffService) { }



    @Public()
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new staff member' })
    @ApiResponse({ status: 201, description: 'Staff created' })

    create(@Body() dto: CreateStaffDto, @Req() req: any) {
        const { departmentId, ...rest } = dto as any;
        const data: any = { ...rest };
        if (departmentId) {
            data.department = { connect: { id: departmentId } };
        }
        if (req.user.sub) {
            data.createdById = req.user.sub
        }

        return this.staffService.create(data);
    }

    @Get()
    @ApiOperation({ summary: 'List all staff' })
    @ApiResponse({ status: 200, description: 'Staff list returned' })
    findAll() {

        return this.staffService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a staff member by ID' })
    @ApiResponse({ status: 200, description: 'Staff member returned' })
    @UseGuards(JwtAuthGuard)
    async findOne(@Param('id') id: string) {
        const staff = await this.staffService.findById(id);
        if (!staff) {
            throw new NotFoundException('Staff member not found');
        }
        return staff;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a staff member' })
    @UseGuards(JwtAuthGuard)
    update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
        const { departmentId, ...rest } = dto as any;
        const data: any = { ...rest };
        if (departmentId) {
            data.department = { connect: { id: departmentId } };
        }
        return this.staffService.update(id, data);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a staff member' })
    @UseGuards(JwtAuthGuard)
    remove(@Param('id') id: string) {
        return this.staffService.remove(id);
    }
}
