/*
Authenticated endpoint that streams the selected documents to the client as a
single zip download.
*/


import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/create-export.dto';

@Controller('exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private exportsService: ExportsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async createExport(
    @Body() createExportDto: CreateExportDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const userId = req.user.id;

    // Create ZIP and stream it to the client
    const { stream, filename } = await this.exportsService.exportDocuments(
      createExportDto.documentIds,
      userId,
    );

    // Set response headers
    res.attachment(filename);
    res.setHeader('Content-Type', 'application/zip');

    // Pipe the archive stream to the response
    stream.pipe(res);
  }
}
