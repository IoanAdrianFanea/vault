import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { pipeline } from 'stream';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArchiveService } from './archive.service';

@Controller('archive')
@UseGuards(JwtAuthGuard)
export class ArchiveController {
  private readonly logger = new Logger(ArchiveController.name);

  constructor(private readonly archiveService: ArchiveService) {}

  @Get()
  async listArchivedProjects(
    @Request() req: { user?: { id?: string; sub?: string; role?: string } },
  ) {
    this.requireAdmin(req);
    return this.archiveService.listArchivedProjects();
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async archiveProject(
    @Param('id') id: string,
    @Request() req: { user?: { id?: string; sub?: string; role?: string } },
  ) {
    const userId = this.requireAdmin(req);
    return this.archiveService.archiveProject(id, userId);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async unarchiveProject(
    @Param('id') id: string,
    @Request() req: { user?: { id?: string; sub?: string; role?: string } },
  ) {
    const userId = this.requireAdmin(req);
    return this.archiveService.unarchiveProject(id, userId);
  }

  @Get(':id/download')
  async downloadArchive(
    @Param('id') id: string,
    @Request() req: { user?: { id?: string; sub?: string; role?: string } },
    @Res() res: Response,
  ) {
    const userId = this.requireAdmin(req);
    const { stream, filename, sizeBytes } =
      await this.archiveService.getArchiveDownload(id, userId);

    res.attachment(filename);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', sizeBytes);

    pipeline(stream, res, (err) => {
      if (err) {
        this.logger.error(
          `Failed to pipe archive download stream: ${String(err)}`,
        );
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy(err);
        }
      }
    });
  }

  @Delete(':id')
  async deleteArchivedProject(
    @Param('id') id: string,
    @Request() req: { user?: { id?: string; sub?: string; role?: string } },
  ) {
    const userId = this.requireAdmin(req);
    return this.archiveService.deleteArchivedProject(id, userId);
  }

  private requireAdmin(req: {
    user?: { id?: string; sub?: string; role?: string };
  }): string {
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
