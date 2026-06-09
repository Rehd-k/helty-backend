import { PartialType } from '@nestjs/swagger';
import { CreateLabAstResultOptionDto } from './create-lab-ast-result-option.dto';

export class UpdateLabAstResultOptionDto extends PartialType(
  CreateLabAstResultOptionDto,
) {}
