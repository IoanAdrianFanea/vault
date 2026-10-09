/*
Nest module that wires the documents controller to the documents and
text-extraction services, and exports DocumentsService.
*/


import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ExtractionService } from './extraction.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ExportsModule } from '../exports/exports.module';

// Documents module for upload and text extraction
@Module({
  imports: [PrismaModule, StorageModule, ExportsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, ExtractionService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
