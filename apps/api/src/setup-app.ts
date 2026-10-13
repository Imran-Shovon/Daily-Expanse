import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { CSRF_HEADER } from './common/auth/csrf.guard';
import { createValidationPipe } from './common/validation/validation';
import type { AppConfig } from './config/configuration';
import { REFRESH_COOKIE } from './auth/auth.cookies';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and the integration tests so both run the same pipeline. */
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService<AppConfig, true>);
  const express = app as NestExpressApplication;

  express.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  express.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({
    origin: config.get('WEB_URL', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER],
    exposedHeaders: ['Content-Disposition'],
  });
  app.enableShutdownHooks();
}

export function setupSwagger(app: INestApplication) {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Daily Expense Tracker API')
      .setDescription(
        'REST API for the Daily Expense Tracker. Authenticate with POST /auth/login, then use the returned accessToken as a Bearer token. Amounts are decimal strings; dates are YYYY-MM-DD in the user time zone.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth(REFRESH_COOKIE)
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
