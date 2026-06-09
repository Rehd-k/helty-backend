import { PartialType } from '@nestjs/swagger';
import { CreateLabAntibioticDto } from './create-lab-antibiotic.dto';

export class UpdateLabAntibioticDto extends PartialType(CreateLabAntibioticDto) {}
