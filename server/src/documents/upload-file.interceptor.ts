/*
Multer interceptor for the single 'file' upload field, capped at
MAX_UPLOAD_MB. Turns an oversized file into a 413 with a readable size limit
message.
*/


import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';

@Injectable()
export class DocumentUploadInterceptor implements NestInterceptor {
  private readonly maxMb: number;
  private readonly inner: NestInterceptor;

  constructor(config: ConfigService) {
    this.maxMb = config.get<number>('MAX_UPLOAD_MB') ?? 50;
    const Inner = FileInterceptor('file', {
      limits: { fileSize: this.maxMb * 1024 * 1024, files: 1 },
    });
    this.inner = new Inner();
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    try {
      return await this.inner.intercept(context, next);
    } catch (error) {
      if (
        error instanceof PayloadTooLargeException ||
        error?.code === 'LIMIT_FILE_SIZE'
      ) {
        throw new PayloadTooLargeException(
          `File is larger than ${this.maxMb} MB.`,
        );
      }
      throw error;
    }
  }
}
