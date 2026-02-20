import { SetMetadata } from '@nestjs/common';

export const DEPARTMENTS_KEY = 'departments';
export const Departments = (...names: string[]) => SetMetadata(DEPARTMENTS_KEY, names);
