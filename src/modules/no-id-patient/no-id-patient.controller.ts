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
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { NoIdPatientService } from './no-id-patient.service';
import {
    CreateNoIdPatientDto,
    MergeNoIdPatientDto,
    UpdateNoIdPatientDto,
} from './dto/no-id-patient.dto';

@ApiTags('NoIdPatient')
@Controller('no-id-patient')
export class NoIdPatientController {
    constructor(private readonly noIdPatientService: NoIdPatientService) { }

    // ─── CRUD ──────────────────────────────────────────────────────────────────

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a walk-in / unregistered patient',
        description:
            'Creates a NoIdPatient record for a walk-in patient who has not yet been registered ' +
            'in the system. Services and transactions can be linked before eventually transferring ' +
            'everything to a full Patient record via the merge endpoint.',
    })
    @ApiBody({ type: CreateNoIdPatientDto })
    create(@Body() dto: CreateNoIdPatientDto) {
        return this.noIdPatientService.create(dto);
    }

    @Get()
    @ApiOperation({
        summary: 'List all unregistered (NoId) patients — paginated',
    })
    @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
    @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
    findAll(
        @Query('skip') skip = '0',
        @Query('take') take = '20',
    ) {
        return this.noIdPatientService.findAll(+skip, +take);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single NoIdPatient with linked services & transactions' })
    @ApiParam({ name: 'id', description: 'NoIdPatient UUID' })
    findOne(@Param('id') id: string) {
        return this.noIdPatientService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update meta fields (name, age, gender) of a NoIdPatient' })
    @ApiParam({ name: 'id', description: 'NoIdPatient UUID' })
    @ApiBody({ type: UpdateNoIdPatientDto })
    update(@Param('id') id: string, @Body() dto: UpdateNoIdPatientDto) {
        return this.noIdPatientService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Delete a NoIdPatient record',
        description:
            'Only succeeds if the record has no linked services or transactions. ' +
            'Use the merge endpoint first if there are linked records.',
    })
    @ApiParam({ name: 'id', description: 'NoIdPatient UUID' })
    remove(@Param('id') id: string) {
        return this.noIdPatientService.remove(id);
    }

    // ─── Services Sub-resource ─────────────────────────────────────────────────

    @Get(':id/services')
    @ApiOperation({ summary: 'List all services linked to a NoIdPatient' })
    @ApiParam({ name: 'id', description: 'NoIdPatient UUID' })
    getServices(@Param('id') id: string) {
        return this.noIdPatientService.getServices(id);
    }

    @Post(':id/services/:serviceId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Link an existing Service to a NoIdPatient',
        description: 'Associates an already-created Service record with this NoIdPatient.',
    })
    @ApiParam({ name: 'id', description: 'NoIdPatient UUID' })
    @ApiParam({ name: 'serviceId', description: 'Service UUID' })
    addService(
        @Param('id') id: string,
        @Param('serviceId') serviceId: string,
    ) {
        return this.noIdPatientService.addService(id, serviceId);
    }

    @Delete(':id/services/:serviceId')
    @ApiOperation({ summary: 'Unlink a Service from a NoIdPatient' })
    @ApiParam({ name: 'id', description: 'NoIdPatient UUID' })
    @ApiParam({ name: 'serviceId', description: 'Service UUID' })
    removeService(
        @Param('id') id: string,
        @Param('serviceId') serviceId: string,
    ) {
        return this.noIdPatientService.removeService(id, serviceId);
    }

    // ─── Merge / Transfer ──────────────────────────────────────────────────────

    @Post('merge')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Transfer all data from a NoIdPatient to a registered Patient',
        description:
            'Atomically migrates all Transactions from the NoIdPatient to the given Patient, ' +
            'detaches all linked Services (clearing their noIdPatientId), and then deletes ' +
            'the NoIdPatient row. Returns a summary of how many records were affected.',
    })
    @ApiBody({ type: MergeNoIdPatientDto })
    merge(@Body() dto: MergeNoIdPatientDto) {
        return this.noIdPatientService.mergeIntoPatient(
            dto.noIdPatientId,
            dto.patientId,
        );
    }
}
