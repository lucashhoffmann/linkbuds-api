import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';

function parseCorsOrigins(corsOrigin?: string) {
  return (corsOrigin ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV');
  const isDev = nodeEnv === 'DEV' || nodeEnv === 'development';
  const allowedOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGIN'),
  );

  // Public pages are served from any custom domain; those routes read no session.
  app.enableCors(
    (req: { url?: string; headers: { origin?: string } }, callback) => {
      const origin = req.headers.origin;

      callback(null, {
        origin:
          isDev ||
          !origin ||
          Boolean(req.url?.startsWith('/public/')) ||
          allowedOrigins.includes(origin),
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      });
    },
  );

  await app.listen(process.env.PORT ?? 3030);
}

void bootstrap();
