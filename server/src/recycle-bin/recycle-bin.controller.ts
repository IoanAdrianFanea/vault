/*
Admin-only HTTP endpoints for the recycle bin: list deleted documents and
projects, restore them or delete them permanently.
*/


import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecycleBinService } from './recycle-bin.service';

// Recycle bin — soft-deleted documents and projects within the retention window. ADMIN ONLY.
@Controller('recycle-bin')
@UseGuards(JwtAuthGuard)
export class RecycleBinController {
  constructor(private readonly recycleBinService: RecycleBinService) {}

  // List soft-deleted documents whose project is still active - ADMIN ONLY
  @Get()
  async listDeletedDocuments(@Request() req) {
    const userId = this.requireAdmin(req);
    return this.recycleBinService.listDeletedDocuments(userId);
  }

  // List soft-deleted projects - ADMIN ONLY
  @Get('projects')
  async listDeletedProjects(@Request() req) {
    const userId = this.requireAdmin(req);
    return this.recycleBinService.listDeletedProjects(userId);
  }

  // List every soft-deleted document within a deleted project - ADMIN ONLY
  @Get('projects/:id/documents')
  async listDeletedProjectDocuments(@Param('id') id: string, @Request() req) {
    const userId = this.requireAdmin(req);
    return this.recycleBinService.listDeletedProjectDocuments(userId, id);
  }

  // Restore a soft-deleted project and every document swept up by its deletion - ADMIN ONLY
  @Post('projects/:id/restore')
  async restoreProject(@Param('id') id: string, @Request() req) {
    const userId = this.requireAdmin(req);
    return this.recycleBinService.restoreProject(id, userId);
  }

  // Permanently delete a soft-deleted project - ADMIN ONLY
  @Delete('projects/:id')
  async permanentlyDeleteProject(@Param('id') id: string, @Request() req) {
    const userId = this.requireAdmin(req);
    return this.recycleBinService.permanentlyDeleteProject(id, userId);
  }

  // Restore a soft-deleted document - ADMIN ONLY
  // `targetProjectId` lets the admin choose the destination project; required when the
  // document's original project has itself been deleted.
  @Post(':id/restore')
  async restoreDocument(
    @Param('id') id: string,
    @Body() body: { targetProjectId?: string } = {},
    @Request() req,
  ) {
    const userId = this.requireAdmin(req);
    return this.recycleBinService.restoreDocument(
      id,
      userId,
      body?.targetProjectId,
    );
  }

  // Permanently delete a soft-deleted document - ADMIN ONLY
  @Delete(':id')
  async permanentlyDeleteDocument(@Param('id') id: string, @Request() req) {
    const userId = this.requireAdmin(req);
    return this.recycleBinService.permanentlyDeleteDocument(id, userId);
  }

  private requireAdmin(req): string {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this resource');
    }

    return userId;
  }
}
