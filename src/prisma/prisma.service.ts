import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
// adapter-pg is required now that the generated client uses the
// new "client" engine type.  We provide an adapter instance so
// PrismaClient can initialize correctly in a traditional Node.js
// environment.  Alternatively you could supply an `accelerateUrl`
// if using Prisma Accelerate.
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Extending PrismaClient directly gives us properly typed model
 * properties (e.g. `bill`, `billItem`, etc.) so that services
 * can use `this.prisma.<model>` without triggering `any`/unsafe
 * warnings from eslint/TS.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ["error", "warn"],
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
