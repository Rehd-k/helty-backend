import { SetMetadata } from '@nestjs/common';

// Marks a route as publicly accessible (skips auth guards)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
