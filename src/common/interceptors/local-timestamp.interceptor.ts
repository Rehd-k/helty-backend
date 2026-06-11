import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { appendLocalTimestamps } from '../utils/datetime';

@Injectable()
export class LocalTimestampInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (data === null || data === undefined) {
          return data;
        }

        if (
          typeof data === 'string' ||
          typeof data === 'number' ||
          typeof data === 'boolean'
        ) {
          return data;
        }

        if (Buffer.isBuffer(data)) {
          return data;
        }

        return appendLocalTimestamps(data);
      }),
    );
  }
}
