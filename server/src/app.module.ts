/*
Root Nest module: loads and validates config, sets up scheduling and the
global rate limit, and imports every feature module.
*/


import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { AppThrottlerGuard } from './common/app-throttler.guard';
import { ONE_MINUTE_MS, TOO_MANY_ATTEMPTS_MESSAGE } from './common/throttle';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DocumentsModule } from './documents/documents.module';
import { ExportsModule } from './exports/exports.module';
import { ProjectsModule } from './projects/projects.module';
import { EmailModule } from './email/email.module';
import { RecycleBinModule } from './recycle-bin/recycle-bin.module';
import { FiltersModule } from './filters/filters.module';
import { ArchiveModule } from './archive/archive.module';
import { BackupModule } from './backup/backup.module';
import path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '.env'),
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: ONE_MINUTE_MS, limit: 300 }],
      errorMessage: TOO_MANY_ATTEMPTS_MESSAGE,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    DocumentsModule,
    ExportsModule,
    ProjectsModule,
    EmailModule,
    RecycleBinModule,
    FiltersModule,
    ArchiveModule,
    BackupModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
