import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImshAndroidController } from './imsh-android.controller';
import { ImshAndroidService } from './imsh-android.service';

@Module({
  imports: [PrismaModule],
  controllers: [ImshAndroidController],
  providers: [ImshAndroidService],
  exports: [ImshAndroidService],
})
export class ImshAndroidModule {}
