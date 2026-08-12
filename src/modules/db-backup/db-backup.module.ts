import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DbBackupController } from './db-backup.controller';
import { DbBackupScheduler } from './db-backup.scheduler';
import { DbBackupService } from './db-backup.service';

@Module({
  imports: [PrismaModule],
  controllers: [DbBackupController],
  providers: [DbBackupService, DbBackupScheduler],
  exports: [DbBackupService],
})
export class DbBackupModule {}
