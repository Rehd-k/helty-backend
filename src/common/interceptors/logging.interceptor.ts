import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { exceptionMessage } from '../filters/http-exception.filter';

const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const magenta = '\x1b[35m';
const cyan = '\x1b[36m';
const white = '\x1b[37m';

type RequestWithUser = Request & {
  user?: { id?: string; role?: string };
};

function methodColor(method: string): string {
  switch (method) {
    case 'GET':
      return green;
    case 'POST':
      return cyan;
    case 'PUT':
      return yellow;
    case 'PATCH':
      return magenta;
    case 'DELETE':
      return red;
    default:
      return white;
  }
}

function statusColor(status: number): string {
  if (status < 300) return green;
  if (status < 400) return cyan;
  if (status < 500) return yellow;
  return red;
}

function durationColor(durationMs: number): string {
  if (durationMs < 300) return green;
  if (durationMs < 1000) return yellow;
  return red;
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (req.ip) return req.ip;
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;
  return '-';
}

function userLabel(req: RequestWithUser): string {
  if (!req.user) return 'anonymous';
  return `${req.user.role ?? 'user'}:${req.user.id ?? '?'}`;
}

function shortUserAgent(agent: string): string {
  let label = agent;
  if (agent.includes('Dart')) label = 'Flutter/Dart';
  else if (agent.includes('Postman')) label = 'Postman';
  else if (agent.includes('insomnia')) label = 'Insomnia';
  else if (agent.includes('Mozilla')) label = 'Browser';
  if (label.length > 24) return `${label.slice(0, 24)}…`;
  return label;
}

function numericStatus(err: unknown): number {
  if (
    err !== null &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  ) {
    return (err as { status: number }).status;
  }
  return 500;
}

function formatLine(input: {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  ip: string;
  user: string;
  agent: string;
  error?: string;
}): string {
  const method = `${bold}${methodColor(input.method)}${input.method.padEnd(7)}${reset}`;
  const status = `${statusColor(input.status)}${input.status}${reset}`;
  const duration = `${durationColor(input.durationMs)}${String(input.durationMs).padStart(4)}ms${reset}`;
  const url = `${white}${input.url}${reset}`;
  const meta = `${dim}${input.ip} · ${input.user} · ${input.agent}${reset}`;
  let line = `${method} ${status} ${duration} ${url}  ${meta}`;
  if (input.status >= 400 && input.error) {
    line += ` ${red}${input.error}${reset}`;
  }
  return line;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const res = context.switchToHttp().getResponse<Response>();
    const started = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;

    const write = (status: number, error?: string) => {
      const line = formatLine({
        method,
        url,
        status,
        durationMs: Date.now() - started,
        ip: clientIp(req),
        user: userLabel(req),
        agent: shortUserAgent(req.get('user-agent') ?? '-'),
        error,
      });
      if (status >= 500) this.logger.error(line);
      else if (status >= 400) this.logger.warn(line);
      else this.logger.log(line);
    };

    return next.handle().pipe(
      tap({
        next: () => write(res.statusCode),
        error: (err: unknown) =>
          write(numericStatus(err), exceptionMessage(err)),
      }),
    );
  }
}
