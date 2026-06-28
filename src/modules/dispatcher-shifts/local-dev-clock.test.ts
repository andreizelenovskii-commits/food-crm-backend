import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("local clock override file is gitignored but example env is committed", () => {
  const gitignore = readFileSync(resolve(".gitignore"), "utf8");

  assert.match(gitignore, /\.local-dev-clock\.json/);
  assert.match(gitignore, /!\.env\.local\.example/);
});

test("backend local env example contains no production domains or credentials", () => {
  const source = readFileSync(resolve(".env.local.example"), "utf8");

  assert.match(source, /DATABASE_URL=postgresql:\/\/food_crm_local:food_crm_local_dev@127\.0\.0\.1:5432\/food_crm_local/);
  assert.match(source, /NODE_ENV=development/);
  assert.match(source, /BACKEND_SESSION_COOKIE_NAME=food_crm_local_api_session/);
  assert.match(source, /BACKEND_SESSION_COOKIE_DOMAIN=\n/);
  assert.match(source, /BACKEND_CORS_ORIGIN=http:\/\/localhost:3000,http:\/\/127\.0\.0\.1:3000/);
  assert.match(source, /SMSAERO_ENABLED=false/);
  assert.match(source, /LOCAL_DEV_TOOLS_ENABLED=true/);
  assert.doesNotMatch(source, /api\.crmandromeda\.ru|crm\.crmandromeda\.ru|food_crm\b/);
});

test("local time script uses the safe clock parser", () => {
  const source = readFileSync(resolve("scripts/local-time.ts"), "utf8");

  assert.match(source, /parseBusinessDateTime/);
  assert.match(source, /Local development clock override/);
});
