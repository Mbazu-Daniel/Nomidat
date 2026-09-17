import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { parseApiEnv } from "./config/env";

async function bootstrap(): Promise<void> {
  const env = parseApiEnv();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: env.WEB_ORIGIN,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();
  await app.listen(env.API_PORT);
}

void bootstrap();
