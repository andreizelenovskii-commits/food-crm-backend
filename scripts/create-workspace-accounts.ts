import "dotenv/config";
import { hashPassword, assertStrongPassword } from "@backend/modules/auth/auth.password";
import { pool } from "@backend/shared/db/pool";
import { parseLoginPhone } from "@backend/lib/phone";
import type { UserRole } from "@backend/modules/auth/auth.types";

type WorkspaceAccount = {
  key: string;
  name: string;
  role: Extract<UserRole, "Повар" | "Курьер" | "Диспетчер">;
  phone: string;
  email: string;
};

const WORKSPACE_ACCOUNTS: WorkspaceAccount[] = [
  {
    key: "COOK",
    name: "Рабочий экран кухни",
    role: "Повар",
    phone: "+7 900 000-10-01",
    email: "workspace-cook@foodlike.local",
  },
  {
    key: "COURIER",
    name: "Рабочий экран курьера",
    role: "Курьер",
    phone: "+7 900 000-10-02",
    email: "workspace-courier@foodlike.local",
  },
  {
    key: "DISPATCHER",
    name: "Рабочий экран диспетчера",
    role: "Диспетчер",
    phone: "+7 900 000-10-03",
    email: "workspace-dispatcher@foodlike.local",
  },
];

function getPassword(account: WorkspaceAccount) {
  const rolePassword = process.env[`${account.key}_WORKSPACE_PASSWORD`]?.trim();
  const sharedPassword = process.env.WORKSPACE_PASSWORD?.trim();
  const password = rolePassword || sharedPassword;

  if (!password) {
    throw new Error(
      `Missing ${account.key}_WORKSPACE_PASSWORD or WORKSPACE_PASSWORD for ${account.name}`,
    );
  }

  assertStrongPassword(password);
  return password;
}

async function upsertWorkspaceAccount(account: WorkspaceAccount) {
  const login = parseLoginPhone(account.phone);
  const passwordHash = hashPassword(getPassword(account), { validateStrength: true });

  await pool.query(
    `
      INSERT INTO "User" ("phone", "password", "role")
      VALUES ($1, $2, $3)
      ON CONFLICT ("phone")
      DO UPDATE SET
        "password" = EXCLUDED."password",
        "role" = EXCLUDED."role",
        "passwordUpdatedAt" = NOW()
    `,
    [login, passwordHash, account.role],
  );

  await pool.query(
    `
      INSERT INTO "Employee" ("name", "email", "role", "phone", "messenger", "passwordUpdatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT ("email")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "role" = EXCLUDED."role",
        "phone" = EXCLUDED."phone",
        "messenger" = EXCLUDED."messenger",
        "passwordUpdatedAt" = NOW()
    `,
    [account.name, account.email, account.role, account.phone, "Рабочий общий профиль"],
  );

  console.log(`${account.name}: ${login} (${account.role})`);
}

async function main() {
  for (const account of WORKSPACE_ACCOUNTS) {
    await upsertWorkspaceAccount(account);
  }

  console.log("Workspace accounts are ready.");
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
