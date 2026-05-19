import test from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import { registerErrorHandler } from "@backend/lib/error-handler";
import { AuthorizationError } from "@backend/lib/http-errors";
import {
  AuthenticationError,
  ValidationError,
} from "@backend/shared/errors/app-error";

test("API errors use the shared envelope for client errors", async () => {
  const app = fastify({ logger: false });
  registerErrorHandler(app);
  app.get("/validation", async () => {
    throw new ValidationError("Некорректные данные");
  });
  app.get("/auth", async () => {
    throw new AuthenticationError("Authentication required");
  });
  app.get("/forbidden", async () => {
    throw new AuthorizationError("Access denied");
  });

  const validation = await app.inject("/validation");
  const auth = await app.inject("/auth");
  const forbidden = await app.inject("/forbidden");

  assert.equal(validation.statusCode, 400);
  assert.deepEqual(validation.json(), {
    error: { code: "VALIDATION_ERROR", message: "Некорректные данные" },
  });
  assert.equal(auth.statusCode, 401);
  assert.deepEqual(auth.json(), {
    error: { code: "AUTHENTICATION_ERROR", message: "Authentication required" },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.deepEqual(forbidden.json(), {
    error: { code: "AUTHORIZATION_ERROR", message: "Access denied" },
  });

  await app.close();
});

test("API errors hide unexpected server error messages", async () => {
  const app = fastify({ logger: false });
  registerErrorHandler(app);
  app.get("/boom", async () => {
    throw new Error("database secret detail");
  });

  const response = await app.inject("/boom");

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });

  await app.close();
});
