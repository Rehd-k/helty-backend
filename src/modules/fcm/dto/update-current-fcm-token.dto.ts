import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCurrentFcmTokenDto {
  @ApiProperty({ description: 'New FCM registration token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @ApiPropertyOptional({ example: 'ios' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;
}
