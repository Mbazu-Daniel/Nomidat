import { Catch, ExceptionFilter, HttpException, ArgumentsHost, Logger } from "@nestjs/common";
import type { Response } from "express";

const logger = new Logger("ErrorFilter");

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let message = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === "string" ? res : (res as { message?: string }).message ?? message;
    } else {
      logger.error("Unhandled exception", exception as Error);
    }

    response.status(status).json({ statusCode: status, message });
  }
}
