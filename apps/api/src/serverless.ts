import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { setupApp, setupSwagger } from './setup-app';

let instance: Promise<Express> | undefined;

/**
 * Builds the Nest application once per function instance and returns the underlying Express
 * handler. Used by the Vercel Function in apps/server; local and Docker runs use main.ts.
 */
export function getServer(): Promise<Express> {
  instance ??= (async () => {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    setupApp(app);
    if (process.env.SWAGGER_ENABLED !== 'false') setupSwagger(app);
    await app.init();
    return app.getHttpAdapter().getInstance() as Express;
  })().catch((error) => {
    instance = undefined; // allow a retry on the next request
    throw error;
  });
  return instance;
}
