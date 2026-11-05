import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { staffAuditAls, storeFromRequest } from '../audit/staff-audit.context';

@Injectable()
export class StaffAuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const store = storeFromRequest(context.switchToHttp().getRequest());
    return new Observable((subscriber) => {
      const subscription = staffAuditAls.run(store, () =>
        next.handle().subscribe(subscriber),
      );
      return () => subscription.unsubscribe();
    });
  }
}
