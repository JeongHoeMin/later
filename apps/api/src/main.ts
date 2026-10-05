import 'dotenv/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { readTrustedProxyCidrs } from './auth/infrastructure/rate-limit/client-ip.js';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { setupOpenApi } from './common/openapi/setup-openapi.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  app.set(
    'trust proxy',
    readTrustedProxyCidrs(process.env.TRUSTED_PROXY_CIDRS),
  );
  app.enableShutdownHooks();
  setupOpenApi(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
