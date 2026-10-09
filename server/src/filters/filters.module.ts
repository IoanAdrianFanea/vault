/*
Nest module for the admin-defined custom filter fields, exporting
FiltersService.
*/


import { Module } from '@nestjs/common';
import { FiltersController } from './filters.controller';
import { FiltersService } from './filters.service';

// Custom filter fields module (Phase 3)
@Module({
  controllers: [FiltersController],
  providers: [FiltersService],
  exports: [FiltersService],
})
export class FiltersModule {}
