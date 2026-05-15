import { pool } from "@backend/shared/db/pool";
import { ensureRecentDatabaseBackup } from "@backend/shared/db/backup";
import { withTransaction } from "@backend/shared/db/transaction";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@backend/modules/employees/employees.validation";
import type { Employee } from "@backend/modules/employees/employees.types";
import { ValidationError } from "@backend/shared/errors/app-error";
import {
  calculateMonthlyHours,
  mapEmployeeRoleToUserRole,
  mapRowToEmployee,
  type EmployeeRow,
} from "@backend/modules/employees/employees.repository.shared";
import { employeePhoneToDisplayDigits } from "@backend/modules/employees/employees.repository.phone";

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  await ensureRecentDatabaseBackup("employee-create");
  const result = await pool.query<EmployeeRow>(
    `
      INSERT INTO "Employee" ("name", "email", "role", "phone", "messenger", "schedule", "monthlyHours", "birthDate", "hireDate")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING "id", "name", "email", "role", "phone", "messenger", "schedule", "monthlyHours", "birthDate", "hireDate", "passwordUpdatedAt", "createdAt"
    `,
    [
      input.name,
      null,
      input.role,
      input.phone,
      input.messenger,
      null,
      null,
      input.birthDate,
      input.hireDate,
    ],
  );

  return mapRowToEmployee(result.rows[0]);
}

export async function deleteEmployee(employeeId: number): Promise<boolean> {
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return false;
  }

  const employeeResult = await pool.query<{ phone: string | null }>(
    `
      SELECT "phone"
      FROM "Employee"
      WHERE "id" = $1
      LIMIT 1
    `,
    [employeeId],
  );

  if (!employeeResult.rowCount) {
    return false;
  }

  const phoneDigits = employeePhoneToDisplayDigits(employeeResult.rows[0]?.phone ?? null);

  const orderResult = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM "Order"
      WHERE "employeeId" = $1
    `,
    [employeeId],
  );

  const ordersCount = Number(orderResult.rows[0]?.count ?? 0);

  if (ordersCount > 0) {
    return false;
  }

  return withTransaction(async (client) => {
    await client.query(
      `
        DELETE FROM "EmployeeAdjustment"
        WHERE "employeeId" = $1
      `,
      [employeeId],
    );

    if (/^7\d{10}$/.test(phoneDigits)) {
      await client.query(
        `
          DELETE FROM "User"
          WHERE "phone" = $1
        `,
        [phoneDigits],
      );
    }

    const result = await client.query(
      `
        DELETE FROM "Employee"
        WHERE "id" = $1
      `,
      [employeeId],
    );

    return (result.rowCount ?? 0) > 0;
  });
}

export async function updateEmployee(employeeId: number, input: UpdateEmployeeInput): Promise<Employee | null> {
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return null;
  }

  const beforeResult = await pool.query<{ phone: string | null }>(
    `
      SELECT "phone"
      FROM "Employee"
      WHERE "id" = $1
      LIMIT 1
    `,
    [employeeId],
  );

  const oldPhoneDigits = employeePhoneToDisplayDigits(beforeResult.rows[0]?.phone ?? null);

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`"name" = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.role !== undefined) {
    updates.push(`"role" = $${paramIndex++}`);
    values.push(input.role);
  }
  if (input.phone !== undefined) {
    updates.push(`"phone" = $${paramIndex++}`);
    values.push(input.phone);
  }
  if (input.messenger !== undefined) {
    updates.push(`"messenger" = $${paramIndex++}`);
    values.push(input.messenger);
  }
  if (input.birthDate !== undefined) {
    updates.push(`"birthDate" = $${paramIndex++}`);
    values.push(input.birthDate);
  }
  if (input.hireDate !== undefined) {
    updates.push(`"hireDate" = $${paramIndex++}`);
    values.push(input.hireDate);
  }
  if (input.schedule !== undefined) {
    updates.push(`"schedule" = $${paramIndex++}`);
    values.push(input.schedule);
    if (input.monthlyHours === undefined) {
      const monthlyHours = calculateMonthlyHours(input.schedule);
      updates.push(`"monthlyHours" = $${paramIndex++}`);
      values.push(monthlyHours);
    }
  }
  if (input.monthlyHours !== undefined) {
    updates.push(`"monthlyHours" = $${paramIndex++}`);
    values.push(input.monthlyHours);
  }

  if (updates.length === 0) {
    return null;
  }

  values.push(employeeId);

  return withTransaction(async (client) => {
    const result = await client.query<EmployeeRow>(
      `
        UPDATE "Employee"
        SET ${updates.join(", ")}
        WHERE "id" = $${paramIndex}
        RETURNING "id", "name", "email", "role", "phone", "messenger", "schedule", "monthlyHours", "birthDate", "hireDate", "passwordUpdatedAt", "createdAt"
      `,
      values,
    );

    if (!result.rowCount) {
      return null;
    }

    const updatedEmployee = result.rows[0];
    const newPhoneDigits = employeePhoneToDisplayDigits(updatedEmployee.phone ?? null);

    if (input.phone !== undefined && /^7\d{10}$/.test(oldPhoneDigits) && /^7\d{10}$/.test(newPhoneDigits)) {
      if (oldPhoneDigits !== newPhoneDigits) {
        const newTaken = await client.query<{ id: number }>(
          `SELECT "id" FROM "User" WHERE "phone" = $1 LIMIT 1`,
          [newPhoneDigits],
        );
        const oldUser = await client.query<{ id: number }>(
          `SELECT "id" FROM "User" WHERE "phone" = $1 LIMIT 1`,
          [oldPhoneDigits],
        );
        const oldUserId = oldUser.rows[0]?.id ?? null;
        const newUserId = newTaken.rows[0]?.id ?? null;

        if (newUserId && newUserId !== oldUserId) {
          throw new ValidationError("Этот номер телефона уже занят в системе входа");
        }

        await client.query(
          `
            UPDATE "User"
            SET "phone" = $2
            WHERE "phone" = $1
          `,
          [oldPhoneDigits, newPhoneDigits],
        );
      }
    }

    if (input.role !== undefined && /^7\d{10}$/.test(newPhoneDigits)) {
      await client.query(
        `
          UPDATE "User"
          SET "role" = $2
          WHERE "phone" = $1
        `,
        [newPhoneDigits, mapEmployeeRoleToUserRole(updatedEmployee.role)],
      );
    }

    return mapRowToEmployee(updatedEmployee);
  });
}
