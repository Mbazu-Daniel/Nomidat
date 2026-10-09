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
import { API_ENV } from "./common/config/env.module";
import type { ApiEnv } from "./common/config/env";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Trust exactly one proxy hop. Deployed behind a reverse proxy (README,
  // "Deployment"), `request.ip` is otherwise the *proxy's* address for every
  // caller, so both rate-limit guards — which key on `request.ip` — collapse
  // into a single bucket shared by the whole internet. One is the hop count the
  // documented deployment has; a higher number would let a client spoof its own
  // address and walk straight through the limiter.
  //
  // `trust proxy` is an Express setting, so it is set on the underlying instance
  // rather than on the Nest application, which does not declare it.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.setGlobalPrefix("api/v1");

  // The validated value, not process.env. Reading the raw variable let CORS and
  // the per-request origin check in OrganizationAuthService disagree about which
  // origins are allowed, and defaulted to a port this app never serves.
  const env = app.get<ApiEnv>(API_ENV);
  app.enableCors({
    // A comma-separated list rather than a single URL because the same app is
    // reached as `localhost`, as `127.0.0.1`, and on a phone over the LAN — and a
    // browser treats those as three different origins. Pinning one of them means
    // the other two fail with "Failed to fetch", which reads like a network fault
    // rather than a configuration mismatch.
    origin: env.WEB_ORIGINS,
    credentials: true,
  });

  // Scalar loads its UI + spec from the jsdelivr CDN via inline <script type="module">.
  // Helmet's default contentSecurityPolicy (script-src 'self') blocks that, leaving /docs blank.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
          workerSrc: ["'self'", "blob:"],
        },
      },
      // Scalar's ESM bundle pulls cross-origin chunks; COEP would block them.
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(morgan("combined"));

  app.use(
    json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
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
  await app.listen(env.API_PORT);
}

void bootstrap();
