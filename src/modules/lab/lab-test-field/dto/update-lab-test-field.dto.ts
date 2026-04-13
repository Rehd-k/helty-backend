import { PartialType } from '@nestjs/swagger';
import { CreateLabTestFieldDto } from './create-lab-test-field.dto';

export class UpdateLabTestFieldDto extends PartialType(CreateLabTestFieldDto) {}
