import { SetMetadata } from '@nestjs/common';

export const DISPLAY_ROUTE_KEY = 'displayRoute';

/** Lets a DISPLAY token call this route. Every other route rejects that token. */
export const AllowDisplay = () => SetMetadata(DISPLAY_ROUTE_KEY, true);
