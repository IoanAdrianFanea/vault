/*
Command-line entry point run before the server starts on Render, restoring
the database from a backup if one was requested. Exits with an error if the
restore fails.
*/


import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { restoreDatabaseIfRequested } from '../backup/restore-database';

async function main(): Promise<void> {
  const logger = new Logger('RestoreDatabase');
  try {
    const result = await restoreDatabaseIfRequested(process.env);
    if (result.restored) {
      logger.log(result.message);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Database restore failed: ${message}`);
    process.exit(1);
  }
}

void main();
