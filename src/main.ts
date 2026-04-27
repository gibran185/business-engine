import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { dump as yamlDump } from 'js-yaml';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerEnabled =
    (process.env.SWAGGER_ENABLED ?? (process.env.NODE_ENV !== 'production' ? 'true' : 'false')) ===
    'true';
  const swaggerPath = (process.env.SWAGGER_PATH ?? 'docs').replace(/^\/+/, '');

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(process.env.SWAGGER_TITLE ?? 'Business Engine API')
      .setDescription(process.env.SWAGGER_DESCRIPTION ?? 'API documentation')
      .setVersion(process.env.SWAGGER_VERSION ?? '1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get(`/${swaggerPath}-yaml`, (_req: unknown, res: any) => {
      res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
      res.status(200).send(yamlDump(document));
    });

    SwaggerModule.setup(swaggerPath, app, document, {
      jsonDocumentUrl: `${swaggerPath}-json`,
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
