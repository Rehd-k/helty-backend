import { PartialType } from '@nestjs/swagger';
import { CreateLabTestDto } from './create-lab-test.dto';

export class UpdateLabTestDto extends PartialType(CreateLabTestDto) {}
