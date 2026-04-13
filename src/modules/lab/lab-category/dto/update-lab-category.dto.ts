import { PartialType } from '@nestjs/swagger';
import { CreateLabCategoryDto } from './create-lab-category.dto';

export class UpdateLabCategoryDto extends PartialType(CreateLabCategoryDto) {}
