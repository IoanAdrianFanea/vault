/*
HTTP endpoints for custom filter fields. Any signed-in user can list them;
only admins can create, update or delete them.
*/


import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FiltersService } from './filters.service';
import { CreateFilterDefinitionDto } from './dto/create-filter-definition.dto';
import { UpdateFilterDefinitionDto } from './dto/update-filter-definition.dto';

// Custom filter fields (Phase 3). Reading the list is open to any authenticated user
// (filters appear on the upload form and document list for everyone); managing them
// (create/update/delete) is ADMIN ONLY.
@Controller('filters')
@UseGuards(JwtAuthGuard)
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Get()
  async list() {
    return this.filtersService.list();
  }

  @Post()
  async create(@Body() dto: CreateFilterDefinitionDto, @Request() req) {
    const userId = this.requireAdmin(req);
    return this.filtersService.create(dto, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFilterDefinitionDto,
    @Request() req,
  ) {
    this.requireAdmin(req);
    return this.filtersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    this.requireAdmin(req);
    await this.filtersService.remove(id);
    return { success: true };
  }

  private requireAdmin(req): string {
    const userId = req.user?.id || req.user?.sub;
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this resource');
    }
    return userId;
  }
}
