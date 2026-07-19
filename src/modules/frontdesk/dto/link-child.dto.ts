import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class LinkChildDto {
  @ApiProperty({
    description: 'UUID of the child patient record to link',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  childPatientId: string;
}
