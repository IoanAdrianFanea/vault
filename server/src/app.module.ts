import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '.env'),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
