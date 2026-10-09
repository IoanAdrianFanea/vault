/*
Injectable Prisma client connected to the SQLite database at DATABASE_URL
through the better-sqlite3 adapter. Services use it directly for all database
access.
*/


import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL') ?? 'file:./dev.db';
    const adapter = new PrismaBetterSqlite3({ url });

    super({ adapter });
  }
}
