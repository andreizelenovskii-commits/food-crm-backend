import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "@backend/app";

test("CORS preflight allows bearer authorization header", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/v1/auth/me",
    headers: {
      origin: "https://crm.crmandromeda.ru",
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization",
    },
  });

  assert.equal(response.statusCode, 204);
  assert.match(response.headers["access-control-allow-headers"] as string, /authorization/i);

  await app.close();
});
