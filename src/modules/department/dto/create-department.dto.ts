import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'radiology' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'uuid-of-head-staff' })
  @IsOptional()
  @IsString()
  headId?: string;
}
