import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/** Redis features (client + optional Socket.IO adapter) only when `USE_REDIS=true`. */
export function isUseRedisEnabled(): boolean {
  return process.env.USE_REDIS?.toLowerCase() === 'true';
}

@Global()
@Module({})
export class RedisModule {
  static register(): DynamicModule {
    if (!isUseRedisEnabled()) {
      return {
        module: RedisModule,
        global: true,
        providers: [{ provide: REDIS_CLIENT, useValue: null }],
        exports: [REDIS_CLIENT],
      };
    }

    return {
      module: RedisModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: (config: ConfigService) => {
            const url =
              config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
            return new Redis(url, {
              maxRetriesPerRequest: null,
            });
          },
          inject: [ConfigService],
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }
}
