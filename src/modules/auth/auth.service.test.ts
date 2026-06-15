import test from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError, ValidationError } from "@backend/shared/errors/app-error";
import { hashPassword, verifyPassword } from "@backend/modules/auth/auth.password";
import { changeUserPassword } from "@backend/modules/auth/auth.service";
import type { AuthUserRepository } from "@backend/modules/auth/auth.repository";
import type { AuthUser } from "@backend/modules/auth/auth.types";

function createRepository(user: AuthUser | null) {
  let passwordHash = user?.passwordHash ?? "";
  const revokedSessions: Array<{ userId: number; activeSessionId: string | null }> = [];

  const repository: AuthUserRepository = {
    async findById(userId) {
      if (!user || user.id !== userId) {
        return null;
      }

      return {
        ...user,
        passwordHash,
      };
    },
    async findByPhone() {
      return null;
    },
    async findByLoginKey() {
      return null;
    },
    async create() {
      throw new Error("Not implemented in test");
    },
    async updatePasswordHash(userId, nextPasswordHash) {
      if (!user || user.id !== userId) {
        throw new Error("Unexpected user id");
      }
      passwordHash = nextPasswordHash;
    },
    async updateUser() {
      throw new Error("Not implemented in test");
    },
  };

  return {
    repository,
    sessions: {
      revokeOther: async (userId: number, activeSessionId: string | null) => {
        revokedSessions.push({ userId, activeSessionId });
      },
    },
    getPasswordHash: () => passwordHash,
    getRevokedSessions: () => revokedSessions,
  };
}

test("changeUserPassword verifies current password and stores a strong new hash", async () => {
  const initialPasswordHash = hashPassword("OldPassword123!");
  const { repository, sessions, getPasswordHash, getRevokedSessions } = createRepository({
    id: 1,
    phone: "79991234567",
    passwordHash: initialPasswordHash,
    role: "admin",
  });

  await changeUserPassword(
    1,
    {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      activeSessionId: "current-session",
    },
    { users: repository, sessions },
  );

  assert.notEqual(getPasswordHash(), initialPasswordHash);
  assert.equal(verifyPassword("NewPassword123!", getPasswordHash()).valid, true);
  assert.deepEqual(getRevokedSessions(), [{ userId: 1, activeSessionId: "current-session" }]);
});

test("changeUserPassword rejects invalid current password", async () => {
  const { repository, sessions } = createRepository({
    id: 1,
    phone: "79991234567",
    passwordHash: hashPassword("OldPassword123!"),
    role: "admin",
  });

  await assert.rejects(
    changeUserPassword(
      1,
      {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword123!",
      },
      { users: repository, sessions },
    ),
    AuthenticationError,
  );
});

test("changeUserPassword validates new password strength", async () => {
  const { repository, sessions } = createRepository({
    id: 1,
    phone: "79991234567",
    passwordHash: hashPassword("OldPassword123!"),
    role: "admin",
  });

  await assert.rejects(
    changeUserPassword(
      1,
      {
        currentPassword: "OldPassword123!",
        newPassword: "weak",
      },
      { users: repository, sessions },
    ),
    ValidationError,
  );
});

test("verifyPassword accepts old unpeppered hashes after pepper is enabled", () => {
  const password = "OldPassword123!";
  const oldHash = hashPassword(password);

  process.env.PASSWORD_PEPPER = "test-pepper-at-least-32-characters-long";

  const result = verifyPassword(password, oldHash);
  assert.equal(result.valid, true);
  assert.equal(result.needsRehash, true);
});
