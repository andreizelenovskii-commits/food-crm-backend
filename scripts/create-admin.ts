import "dotenv/config";
import { hashPassword, assertStrongPassword } from "@backend/modules/auth/auth.password";
import { pool } from "@backend/shared/db/pool";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const email = getRequiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("ADMIN_PASSWORD");
  const role = process.env.ADMIN_ROLE?.trim() || "admin";

  assertStrongPassword(password);

  await pool.query(
    `
      INSERT INTO "User" ("email", "password", "role")
      VALUES ($1, $2, $3)
      ON CONFLICT ("email")
      DO UPDATE SET
        "password" = EXCLUDED."password",
        "role" = EXCLUDED."role"
    `,
    [email, hashPassword(password, { validateStrength: true }), role],
  );

  console.log(`Admin user is ready: ${email}`);
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
