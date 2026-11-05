import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { persistStaffWrite } from '../common/audit/staff-audit.writer';
// adapter-pg is required now that the generated client uses the
// new "client" engine type.  We provide an adapter instance so
// PrismaClient can initialize correctly in a traditional Node.js
// environment.  Alternatively you could supply an `accelerateUrl`
// if using Prisma Accelerate.
import { PrismaPg } from '@prisma/adapter-pg';

function withLagosTimezone(connectionString?: string): string | undefined {
  if (!connectionString) return connectionString;

  try {
    const url = new URL(connectionString);
    const existingOptions = url.searchParams.get('options');

    if (existingOptions?.includes('timezone=')) {
      return connectionString;
    }

    const lagosTimezoneOption = '-c timezone=Africa/Lagos';
    url.searchParams.set(
      'options',
      existingOptions
        ? `${existingOptions} ${lagosTimezoneOption}`
        : lagosTimezoneOption,
    );
    return url.toString();
  } catch {
    return connectionString;
  }
}

/**
 * Extending PrismaClient directly gives us properly typed model
 * properties (e.g. `bill`, `billItem`, etc.) so that services
 * can use `this.prisma.<model>` without triggering `any`/unsafe
 * warnings from eslint/TS.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ['error', 'warn'],
      omit: {
        patient: { password: true },
      },
      adapter: new PrismaPg({
        connectionString: withLagosTimezone(process.env.DATABASE_URL),
      }),
    });
    // Model calls go through the extended client so every staff write is
    // recorded. Lifecycle hooks stay on this instance. The arrow below keeps
    // the original client, so audit inserts do not pass through the hook.
    const extended = this.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ model, operation, args, query }) => {
            const result = await query(args);
            await persistStaffWrite(this, { model, operation, args, result });
            return result;
          },
        },
      },
    });
    const extendedClient: object = extended;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop === 'onModuleInit' || prop === 'onModuleDestroy') {
          return Reflect.get(target, prop, receiver);
        }
        const value: unknown = Reflect.get(extendedClient, prop, extended);
        if (typeof value === 'function') {
          const fn = value as (...args: unknown[]) => unknown;
          return (...args: unknown[]) =>
            // Function.apply is typed as any in the TS lib.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            fn.apply(extended, args);
        }
        if (value !== undefined) return value;
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
