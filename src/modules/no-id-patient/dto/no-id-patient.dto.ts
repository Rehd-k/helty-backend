import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateNoIdPatientDto {
    @ApiProperty({ example: 'John', description: 'First name of the patient' })
    @IsString()
    firstName: string;

    @ApiProperty({ example: 'Doe', description: 'Surname of the patient' })
    @IsString()
    surname: string;

    @ApiProperty({ example: '35', description: 'Age of the patient' })
    @IsString()
    age: string;

    @ApiProperty({ example: 'MALE', description: 'Gender of the patient' })
    @IsString()
    gender: string;
}

export class UpdateNoIdPatientDto extends PartialType(CreateNoIdPatientDto) { }

export class MergeNoIdPatientDto {
    @ApiProperty({ description: 'UUID of the NoIdPatient record to migrate from' })
    @IsString()
    noIdPatientId: string;

    @ApiProperty({ description: 'UUID of the registered Patient to migrate data into' })
    @IsString()
    patientId: string;
}
