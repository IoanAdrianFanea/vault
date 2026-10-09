/*
Nest module for the recycle bin: its controller, service and the nightly
purge task. Exports RecycleBinService.
*/


import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { RecycleBinController } from './recycle-bin.controller';
import { RecycleBinService } from './recycle-bin.service';
import { PurgeTask } from './purge.task';

// Recycle bin: soft-delete recovery and the 30-day permanent purge
@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [RecycleBinController],
  providers: [RecycleBinService, PurgeTask],
  exports: [RecycleBinService],
})
export class RecycleBinModule {}
