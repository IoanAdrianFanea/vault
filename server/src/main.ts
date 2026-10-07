import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { buildHelmetOptions } from './common/security-headers';

const DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/.+\.local:\d+$/,
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'production';
  const frontendUrl = config.get<string>('FRONTEND_URL');

  // In production, trust the reverse proxy (Render) and prefix API routes
  if (isProduction) {
    app.set('trust proxy', 1);
    app.setGlobalPrefix('api');
  }

  app.use(helmet(buildHelmetOptions(frontendUrl)));

  // Enable CORS for frontend (allows cookies to be sent)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (frontendUrl && origin === frontendUrl) return callback(null, true);
      if (!isProduction && DEV_ORIGIN_PATTERNS.some((p) => p.test(origin)))
        return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  // Parse cookies from requests (needed for refresh token)
  app.use(cookieParser());

  // Automatically validate all incoming requests using DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // In production, serve the React build and handle client-side routing
  if (isProduction) {
    const clientDist = join(__dirname, '..', '..', '..', 'client', 'dist');
    app.useStaticAssets(clientDist);

    // Only serve index.html for non-API routes
    app.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(join(clientDist, 'index.html'));
    });
  }

  await app.listen(config.get('PORT') ?? 3000);
}
bootstrap();
