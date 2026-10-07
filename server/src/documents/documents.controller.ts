import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { DocumentUploadInterceptor } from './upload-file.interceptor';
import { detectFileType } from './file-signature.util';
import { SearchQueryDto } from './dto/search-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { ExportsService } from '../exports/exports.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly exportsService: ExportsService,
  ) {}

  /**
   * Upload a PDF or image file
   */
  @Post('upload')
  @UseInterceptors(DocumentUploadInterceptor)
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Request() req,
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, JPEG, and PNG files are supported',
      );
    }

    if (detectFileType(file.buffer) !== file.mimetype) {
      throw new BadRequestException("This file isn't a valid PDF, JPG or PNG.");
    }

    return this.documentsService.uploadDocument(
      userId,
      file,
      dto.projectId,
      dto.filterValues,
    );
  }

  /**
   * Search documents by text content
   */
  @Get('search')
  async searchDocuments(@Query() searchQuery: SearchQueryDto, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.documentsService.searchDocuments(userId, searchQuery.q);
  }

  /**
   * Get extracted text for a document
   */
  @Get(':id/text')
  async getDocumentText(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.documentsService.getDocumentText(id, userId);
  }

  /**
   * Download a document's PDF file
   */
  @Get(':id/download')
  async downloadDocument(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const { buffer, filename, mimeType } =
      await this.exportsService.downloadDocument(id, userId);

    res.attachment(filename);
    res.setHeader('Content-Type', mimeType);
    res.send(buffer);
  }

  /**
   * Get document status counts
   */
  @Get('status-counts')
  async getStatusCounts(@Request() req, @Query() query: ListDocumentsQueryDto) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.documentsService.getStatusCounts(userId, query);
  }

  /**
   * Get a single document by ID
   */
  @Get(':id')
  async getDocument(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.documentsService.getDocument(id, userId);
  }

  /**
   * List all documents for current user
   */
  @Get()
  async listDocuments(@Request() req, @Query() query: ListDocumentsQueryDto) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.documentsService.listDocuments(userId, query);
  }

  /**
   * Delete a single document
   */
  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    await this.documentsService.deleteDocument(id, userId);
    return { success: true };
  }

  /**
   * Bulk delete documents
   */
  @Post('bulk-delete')
  async bulkDeleteDocuments(
    @Body() body: { documentIds: string[] },
    @Request() req,
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    if (!Array.isArray(body.documentIds) || body.documentIds.length === 0) {
      throw new BadRequestException('documentIds must be a non-empty array');
    }

    const result = await this.documentsService.bulkDeleteDocuments(
      body.documentIds,
      userId,
    );
    return result;
  }
}
