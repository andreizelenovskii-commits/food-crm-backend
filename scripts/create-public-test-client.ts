import "dotenv/config";
import { parseLoginPhone } from "@backend/lib/phone";
import { normalizeRussianPhoneForStorage } from "@backend/shared/lib/phone";
import { pool } from "@backend/shared/db/pool";

const TEST_PHONE = process.env.PUBLIC_AUTH_TEST_PHONE ?? "79002000001";
const TEST_CODE = process.env.PUBLIC_AUTH_TEST_CODE ?? "111111";

async function main() {
  const phone = parseLoginPhone(TEST_PHONE);
  const displayPhone = normalizeRussianPhoneForStorage(phone);

  await pool.query(
    `
      INSERT INTO "Client" ("name", "type", "email", "phone", "birthDate", "address", "notes")
      VALUES ($1, 'CLIENT', $2, $3, $4, $5, $6)
      ON CONFLICT ("phone")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "email" = EXCLUDED."email",
        "birthDate" = EXCLUDED."birthDate",
        "address" = EXCLUDED."address",
        "notes" = EXCLUDED."notes"
    `,
    [
      "Тестовый Клиент",
      "test-client@foodlike.dev",
      displayPhone,
      "1995-05-24",
      "ул. Тестовая, 1",
      "Тестовый клиент для входа на публичный сайт",
    ],
  );

  console.log("Public test client is ready:");
  console.log(`Phone: ${displayPhone}`);
  console.log(`SMS code: ${TEST_CODE}`);
  console.log("Set these env variables on the backend to enable fixed-code login:");
  console.log(`PUBLIC_AUTH_TEST_PHONE=${phone}`);
  console.log(`PUBLIC_AUTH_TEST_CODE=${TEST_CODE}`);
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
