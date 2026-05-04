import { pool } from "@backend/shared/db/pool";
import { withTransaction } from "@backend/shared/db/transaction";
import { hashPassword } from "@backend/modules/auth/auth.password";
import { ValidationError } from "@backend/shared/errors/app-error";
import type { Employee } from "@backend/modules/employees/employees.types";
import {
  mapEmployeeRoleToUserRole,
  type EmployeeRow,
} from "@backend/modules/employees/employees.repository.shared";
import { getEmployeeById } from "@backend/modules/employees/employees.repository.read";
import {
  employeePhoneToDisplayDigits,
  loginDigitsToEmployeeDisplay,
  loginPhoneToDigits,
} from "@backend/modules/employees/employees.repository.phone";

export async function issueEmployeeAccess(input: {
  employeeId: number;
  phone: string;
  password: string;
}): Promise<Employee | null> {
  if (!Number.isInteger(input.employeeId) || input.employeeId <= 0) {
    return null;
  }

  const phoneDigits = loginPhoneToDigits(input.phone);
  const phoneDisplay = loginDigitsToEmployeeDisplay(phoneDigits);
  const employeeResult = await pool.query<EmployeeRow>(
    `
      SELECT "id", "name", "email", "role", "phone", "messenger", "schedule", "monthlyHours", "birthDate", "hireDate", "createdAt"
      FROM "Employee"
      WHERE "id" = $1
      LIMIT 1
    `,
    [input.employeeId],
  );
  const employeeRow = employeeResult.rows[0];

  if (!employeeRow) {
    return null;
  }

  const role = mapEmployeeRoleToUserRole(employeeRow.role);
  const passwordHash = hashPassword(input.password, { validateStrength: true });
  const oldDigits = employeePhoneToDisplayDigits(employeeRow.phone ?? null);
  const existingNewPhone = await pool.query<{ id: number }>(
    `SELECT "id" FROM "User" WHERE "phone" = $1 LIMIT 1`,
    [phoneDigits],
  );
  const oldUserResult =
    oldDigits && /^7\d{10}$/.test(oldDigits)
      ? await pool.query<{ id: number }>(
          `SELECT "id" FROM "User" WHERE "phone" = $1 LIMIT 1`,
          [oldDigits],
        )
      : { rows: [] as Array<{ id: number }> };
  const currentUserId = oldUserResult.rows[0]?.id ?? null;
  const existingNewPhoneId = existingNewPhone.rows[0]?.id ?? null;

  if (existingNewPhoneId && existingNewPhoneId !== currentUserId) {
    throw new ValidationError("Этот номер телефона уже привязан к другому пользователю");
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE "Employee" SET "phone" = $2 WHERE "id" = $1`,
      [input.employeeId, phoneDisplay],
    );

    if (currentUserId) {
      await client.query(
        `UPDATE "User" SET "phone" = $2, "role" = $3, "password" = $4 WHERE "id" = $1`,
        [currentUserId, phoneDigits, role, passwordHash],
      );
      return;
    }

    await client.query(
      `INSERT INTO "User" ("phone", "password", "role") VALUES ($1, $2, $3)`,
      [phoneDigits, passwordHash, role],
    );
  });

  return getEmployeeById(input.employeeId);
}
