import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { json, urlencoded } from "express";
import type { Request, Response } from "express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.setGlobalPrefix("api/v1");

  app.enableCors({
    origin: process.env.WEB_ORIGIN,
    credentials: true,
  });

  app.use(helmet());
  app.use(compression());
  app.use(morgan("combined"));

  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("Nomidat API")
    .setDescription("Nomidat platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  app.use("/docs-json", (_req: Request, res: Response) => res.json(document));

  app.use(
    "/docs",
    apiReference({
      url: "/docs-json",
      theme: "kepler",
    }),
  );

  app.enableShutdownHooks();
  await app.listen(process.env.API_PORT ?? 3001);
}

void bootstrap();
