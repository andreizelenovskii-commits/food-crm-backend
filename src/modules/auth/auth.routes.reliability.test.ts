import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/modules/auth/auth.routes.ts"), "utf8");

test("auth routes clear known employee cookies without touching public client cookie", () => {
  assert.match(source, /function getKnownEmployeeSessionCookieNames/);
  assert.match(source, /backendEnv\.sessionCookieName/);
  assert.match(source, /"food_crm_api_session"/);
  assert.match(source, /"food_crm_staging_api_session"/);
  assert.doesNotMatch(
    source.match(/function clearEmployeeSessionCookies[\s\S]+?function setNoStore/)?.[0] ?? "",
    /clientSessionCookieName/,
  );
});

test("employee auth endpoints use no-store and cookie cleanup", () => {
  assert.match(source, /app\.post\("\/api\/v1\/auth\/login"[\s\S]+setNoStore\(reply\)/);
  assert.match(source, /app\.post\("\/api\/v1\/auth\/login"[\s\S]+clearEmployeeSessionCookies\(request, reply\)/);
  assert.match(source, /app\.post\("\/api\/v1\/auth\/logout"[\s\S]+setNoStore\(reply\)/);
  assert.match(source, /app\.post\("\/api\/v1\/auth\/logout"[\s\S]+clearEmployeeSessionCookies\(request, reply\)/);
  assert.match(source, /app\.get\("\/api\/v1\/auth\/me"[\s\S]+setNoStore\(reply\)/);
  assert.match(source, /app\.get\("\/api\/v1\/auth\/me"[\s\S]+clearEmployeeSessionCookies\(request, reply\)/);
});
