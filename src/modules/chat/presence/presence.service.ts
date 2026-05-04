import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.constants';

export type PresenceStatus = 'online' | 'away' | 'offline';

const ONLINE_SET_KEY = 'chat:online:staff';

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  private readonly awayMs: number;
  private readonly offlineMs: number;

  private readonly memStatus = new Map<string, PresenceStatus>();
  private readonly memLastSeen = new Map<string, number>();
  private readonly memLastPing = new Map<string, number>();
  private readonly memOnline = new Set<string>();
  private readonly memUnread = new Map<string, number>();

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    private readonly config: ConfigService,
  ) {
    this.awayMs =
      (Number(this.config.get('PRESENCE_AWAY_MINUTES')) || 5) * 60 * 1000;
    this.offlineMs =
      (Number(this.config.get('PRESENCE_OFFLINE_AFTER_MINUTES')) || 60) *
      60 *
      1000;
  }

  private useRedis(): boolean {
    return this.redis != null;
  }

  private unreadMemKey(staffId: string, conversationId: string) {
    return `${staffId}:${conversationId}`;
  }

  onModuleInit() {
    this.sweepTimer = setInterval(() => {
      void this.sweepStale();
    }, 60_000);
  }

  async onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private keyStatus(staffId: string) {
    return `user:${staffId}:status`;
  }
  private keyLastSeen(staffId: string) {
    return `user:${staffId}:lastSeen`;
  }
  private keyLastPing(staffId: string) {
    return `user:${staffId}:lastPingAt`;
  }

  async setOnline(staffId: string): Promise<void> {
    const now = Date.now();
    if (!this.useRedis()) {
      this.memStatus.set(staffId, 'online');
      this.memLastSeen.set(staffId, now);
      this.memLastPing.set(staffId, now);
      this.memOnline.add(staffId);
      return;
    }
    const pipeline = this.redis!.pipeline();
    pipeline.set(this.keyStatus(staffId), 'online');
    pipeline.set(this.keyLastSeen(staffId), String(now));
    pipeline.set(this.keyLastPing(staffId), String(now));
    pipeline.sadd(ONLINE_SET_KEY, staffId);
    await pipeline.exec();
  }

  async heartbeat(staffId: string): Promise<void> {
    const now = Date.now();
    if (!this.useRedis()) {
      this.memStatus.set(staffId, 'online');
      this.memLastSeen.set(staffId, now);
      this.memLastPing.set(staffId, now);
      this.memOnline.add(staffId);
      return;
    }
    const pipeline = this.redis!.pipeline();
    pipeline.set(this.keyStatus(staffId), 'online');
    pipeline.set(this.keyLastSeen(staffId), String(now));
    pipeline.set(this.keyLastPing(staffId), String(now));
    pipeline.sadd(ONLINE_SET_KEY, staffId);
    await pipeline.exec();
  }

  async setAway(staffId: string): Promise<void> {
    const now = Date.now();
    if (!this.useRedis()) {
      this.memStatus.set(staffId, 'away');
      this.memLastSeen.set(staffId, now);
      this.memOnline.delete(staffId);
      return;
    }
    const pipeline = this.redis!.pipeline();
    pipeline.set(this.keyStatus(staffId), 'away');
    pipeline.set(this.keyLastSeen(staffId), String(now));
    pipeline.srem(ONLINE_SET_KEY, staffId);
    await pipeline.exec();
  }

  async setOffline(staffId: string): Promise<void> {
    const now = Date.now();
    if (!this.useRedis()) {
      this.memStatus.set(staffId, 'offline');
      this.memLastSeen.set(staffId, now);
      this.memOnline.delete(staffId);
      return;
    }
    const pipeline = this.redis!.pipeline();
    pipeline.set(this.keyStatus(staffId), 'offline');
    pipeline.set(this.keyLastSeen(staffId), String(now));
    pipeline.srem(ONLINE_SET_KEY, staffId);
    await pipeline.exec();
  }

  async getPresence(staffId: string): Promise<{
    status: PresenceStatus;
    lastSeen: number | null;
    lastPingAt: number | null;
  }> {
    if (!this.useRedis()) {
      return {
        status: this.memStatus.get(staffId) ?? 'offline',
        lastSeen: this.memLastSeen.get(staffId) ?? null,
        lastPingAt: this.memLastPing.get(staffId) ?? null,
      };
    }
    const [status, lastSeen, lastPing] = await Promise.all([
      this.redis!.get(this.keyStatus(staffId)),
      this.redis!.get(this.keyLastSeen(staffId)),
      this.redis!.get(this.keyLastPing(staffId)),
    ]);
    return {
      status: (status as PresenceStatus) || 'offline',
      lastSeen: lastSeen ? Number(lastSeen) : null,
      lastPingAt: lastPing ? Number(lastPing) : null,
    };
  }

  /** Staff ids currently marked online (connected + heartbeating). */
  async getOnlineStaffIds(): Promise<string[]> {
    if (!this.useRedis()) {
      return [...this.memOnline];
    }
    return this.redis!.smembers(ONLINE_SET_KEY);
  }

  private async sweepStale(): Promise<void> {
    try {
      if (!this.useRedis()) {
        const now = Date.now();
        for (const id of [...this.memOnline]) {
          const lastPing = this.memLastPing.get(id) ?? 0;
          if (!lastPing) continue;
          const delta = now - lastPing;
          if (delta >= this.offlineMs) {
            await this.setOffline(id);
            this.logger.debug(`Presence sweep: ${id} -> offline`);
          } else if (delta >= this.awayMs) {
            await this.setAway(id);
            this.logger.debug(`Presence sweep: ${id} -> away (inactive)`);
          }
        }
        return;
      }

      const ids = await this.redis!.smembers(ONLINE_SET_KEY);
      const now = Date.now();
      for (const id of ids) {
        const lastPingRaw = await this.redis!.get(this.keyLastPing(id));
        const lastPing = lastPingRaw ? Number(lastPingRaw) : 0;
        if (!lastPing) continue;
        const delta = now - lastPing;
        if (delta >= this.offlineMs) {
          await this.setOffline(id);
          this.logger.debug(`Presence sweep: ${id} -> offline`);
        } else if (delta >= this.awayMs) {
          await this.setAway(id);
          this.logger.debug(`Presence sweep: ${id} -> away (inactive)`);
        }
      }
    } catch (e) {
      this.logger.warn(`Presence sweep failed: ${e}`);
    }
  }

  unreadKey(staffId: string, conversationId: string) {
    return `unread:${staffId}:${conversationId}`;
  }

  async incrementUnread(
    recipientStaffIds: string[],
    conversationId: string,
  ): Promise<void> {
    if (!this.useRedis()) {
      for (const id of recipientStaffIds) {
        const k = this.unreadMemKey(id, conversationId);
        this.memUnread.set(k, (this.memUnread.get(k) ?? 0) + 1);
      }
      return;
    }
    const pipeline = this.redis!.pipeline();
    for (const id of recipientStaffIds) {
      pipeline.incr(this.unreadKey(id, conversationId));
    }
    await pipeline.exec();
  }

  async clearUnread(staffId: string, conversationId: string): Promise<void> {
    if (!this.useRedis()) {
      this.memUnread.delete(this.unreadMemKey(staffId, conversationId));
      return;
    }
    await this.redis!.del(this.unreadKey(staffId, conversationId));
  }

  async getUnread(staffId: string, conversationId: string): Promise<number> {
    if (!this.useRedis()) {
      return (
        this.memUnread.get(this.unreadMemKey(staffId, conversationId)) ?? 0
      );
    }
    const v = await this.redis!.get(this.unreadKey(staffId, conversationId));
    return v ? Number(v) : 0;
  }

  async getManyUnread(
    staffId: string,
    conversationIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (conversationIds.length === 0) return out;

    if (!this.useRedis()) {
      for (const id of conversationIds) {
        out.set(id, this.memUnread.get(this.unreadMemKey(staffId, id)) ?? 0);
      }
      return out;
    }

    const keys = conversationIds.map((c) => this.unreadKey(staffId, c));
    const vals = await this.redis!.mget(...keys);
    conversationIds.forEach((id, i) => {
      const v = vals[i];
      out.set(id, v ? Number(v) : 0);
    });
    return out;
  }
}
