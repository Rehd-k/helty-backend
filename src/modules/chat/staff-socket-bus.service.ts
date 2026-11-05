import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Staff inbox should reload submitted emergency requests. */
export const EMERGENCY_REQUEST_EVENT = 'emergency_request';

/** Frontdesk login-code list changed. Payload is intentionally empty. */
export const LOGIN_CODES_CHANGED_EVENT = 'login_codes_changed';

/**
 * Broadcasts to every connected staff socket.
 * The chat gateway attaches the Socket.IO server once it is ready.
 */
@Injectable()
export class StaffSocketBus {
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  emit(event: string, payload: Record<string, unknown> = {}): void {
    this.server?.emit(event, payload);
  }
}
