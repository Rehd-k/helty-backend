import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getServerDateTime(): { iso: string; unixMs: number } {
    const now = new Date();
    return { iso: now.toISOString(), unixMs: now.getTime() };
  }
}
