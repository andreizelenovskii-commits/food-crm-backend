import type { FastifyInstance } from "fastify";
import {
  AppError,
  AuthenticationError,
  ValidationError,
} from "@backend/shared/errors/app-error";
import { AuthorizationError } from "@backend/lib/http-errors";

function getStatusCode(error: Error) {
  if (error instanceof ValidationError) {
    return 400;
  }

  if (error instanceof AuthenticationError) {
    return 401;
  }

  if (error instanceof AuthorizationError) {
    return 403;
  }

  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  return 500;
}

function getErrorCode(error: Error) {
  if ("code" in error && typeof error.code === "string" && error.code) {
    return error.code;
  }

  if (error instanceof ValidationError) {
    return "VALIDATION_ERROR";
  }

  if (error instanceof AuthenticationError) {
    return "AUTHENTICATION_ERROR";
  }

  if (error instanceof AuthorizationError) {
    return "AUTHORIZATION_ERROR";
  }

  if (error instanceof AppError) {
    return error.name.toUpperCase();
  }

  return "INTERNAL_ERROR";
}

function getErrorDetails(error: Error) {
  return "details" in error && error.details !== undefined ? error.details : undefined;
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const normalizedError = toError(error);
    const statusCode = getStatusCode(normalizedError);

    const details = getErrorDetails(normalizedError);

    reply.status(statusCode).send({
      error: {
        code: getErrorCode(normalizedError),
        message: statusCode >= 500 ? "Internal server error" : normalizedError.message,
        ...(details === undefined ? {} : { details }),
      },
    });
  });
}
