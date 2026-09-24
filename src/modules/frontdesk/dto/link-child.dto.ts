import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class LinkChildDto {
  @ApiProperty({
    description: 'UUID of the child patient record to link',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  childPatientId!: string;

  @ApiPropertyOptional({
    description:
      'Mark this parent as the principal family contact for medication alerts',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrincipal?: boolean;
}
