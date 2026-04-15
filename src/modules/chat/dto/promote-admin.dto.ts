import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PromoteAdminDto {
  @ApiProperty()
  @IsUUID()
  staffId!: string;
}
