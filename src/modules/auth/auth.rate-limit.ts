import { AuthenticationError } from "@backend/shared/errors/app-error";
import { pool } from "@backend/shared/db/pool";

const WINDOW_MS = 1000 * 60 * 15;
const LOCK_MS = 1000 * 60 * 15;
const MAX_FAILURES_PER_IP = 10;
const MAX_FAILURES_PER_ACCOUNT = 5;
const USE_MEMORY_FALLBACK = process.env.NODE_ENV !== "production";

type AttemptState = {
  count: number;
  windowStartedAt: number;
  lockedUntil: number | null;
};

const attempts = new Map<string, AttemptState>();

type AuthAttemptRow = {
  count: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
};

function getAttemptState(key: string, now: number): AttemptState {
  const existing = attempts.get(key);

  if (!existing) {
    const initialState: AttemptState = {
      count: 0,
      windowStartedAt: now,
      lockedUntil: null,
    };
    attempts.set(key, initialState);
    return initialState;
  }

  if (existing.lockedUntil && existing.lockedUntil <= now) {
    existing.count = 0;
    existing.windowStartedAt = now;
    existing.lockedUntil = null;
  }

  if (now - existing.windowStartedAt >= WINDOW_MS) {
    existing.count = 0;
    existing.windowStartedAt = now;
    existing.lockedUntil = null;
  }

  return existing;
}

function buildRetryMessage(lockedUntil: number, now: number) {
  const retryAfterMinutes = Math.max(1, Math.ceil((lockedUntil - now) / 60000));
  return `Слишком много попыток входа. Попробуй снова через ${retryAfterMinutes} мин.`;
}

function assertNotLocked(key: string, now: number) {
  const state = getAttemptState(key, now);

  if (state.lockedUntil && state.lockedUntil > now) {
    throw new AuthenticationError(buildRetryMessage(state.lockedUntil, now));
  }
}

function recordFailureForKey(key: string, limit: number, now: number) {
  const state = getAttemptState(key, now);
  state.count += 1;

  if (state.count >= limit) {
    state.lockedUntil = now + LOCK_MS;
  }
}

function clearKey(key: string) {
  attempts.delete(key);
}

function buildKeys(accountKey: string, ipAddress: string) {
  return {
    ipKey: `ip:${ipAddress}`,
    accountKey: `login:${accountKey}`,
  };
}

async function getStoredAttemptState(key: string) {
  const result = await pool.query<AuthAttemptRow>(
    `
      SELECT "count", "windowStartedAt", "lockedUntil"
      FROM "auth_attempts"
      WHERE "attemptKey" = $1
      LIMIT 1
    `,
    [key],
  );

  return result.rows[0] ?? null;
}

async function resetStoredAttemptState(key: string, now: number) {
  await pool.query(
    `
      INSERT INTO "auth_attempts" ("attemptKey", "count", "windowStartedAt", "lockedUntil")
      VALUES ($1, 0, $2, NULL)
      ON CONFLICT ("attemptKey") DO UPDATE
      SET "count" = 0,
          "windowStartedAt" = EXCLUDED."windowStartedAt",
          "lockedUntil" = NULL,
          "updatedAt" = NOW()
    `,
    [key, new Date(now)],
  );
}

async function assertStoredNotLocked(key: string, now: number) {
  const state = await getStoredAttemptState(key);

  if (!state) {
    return;
  }

  const lockedUntil = state.lockedUntil?.getTime() ?? null;

  if (lockedUntil && lockedUntil > now) {
    throw new AuthenticationError(buildRetryMessage(lockedUntil, now));
  }

  if (lockedUntil || now - state.windowStartedAt.getTime() >= WINDOW_MS) {
    await resetStoredAttemptState(key, now);
  }
}

async function recordStoredFailureForKey(key: string, limit: number, now: number) {
  const state = await getStoredAttemptState(key);
  const shouldReset =
    !state ||
    (state.lockedUntil !== null && state.lockedUntil.getTime() <= now) ||
    now - state.windowStartedAt.getTime() >= WINDOW_MS;
  const count = shouldReset ? 1 : state.count + 1;
  const windowStartedAt = shouldReset ? now : state.windowStartedAt.getTime();
  const lockedUntil = count >= limit ? now + LOCK_MS : null;

  await pool.query(
    `
      INSERT INTO "auth_attempts" ("attemptKey", "count", "windowStartedAt", "lockedUntil")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("attemptKey") DO UPDATE
      SET "count" = EXCLUDED."count",
          "windowStartedAt" = EXCLUDED."windowStartedAt",
          "lockedUntil" = EXCLUDED."lockedUntil",
          "updatedAt" = NOW()
    `,
    [key, count, new Date(windowStartedAt), lockedUntil ? new Date(lockedUntil) : null],
  );
}

async function clearStoredKey(key: string) {
  await pool.query(
    `
      DELETE FROM "auth_attempts"
      WHERE "attemptKey" = $1
    `,
    [key],
  );
}

async function withDevMemoryFallback(action: () => Promise<void>, fallback: () => void) {
  try {
    await action();
  } catch (error) {
    if (!USE_MEMORY_FALLBACK) {
      throw error;
    }

    fallback();
  }
}

export async function assertCanAttemptLogin(accountKey: string, ipAddress: string) {
  const now = Date.now();
  const { ipKey, accountKey: accKey } = buildKeys(accountKey, ipAddress);

  await withDevMemoryFallback(
    async () => {
      await assertStoredNotLocked(ipKey, now);
      await assertStoredNotLocked(accKey, now);
    },
    () => {
      assertNotLocked(ipKey, now);
      assertNotLocked(accKey, now);
    },
  );
}

export async function recordFailedLoginAttempt(accountKey: string, ipAddress: string) {
  const now = Date.now();
  const { ipKey, accountKey: accKey } = buildKeys(accountKey, ipAddress);

  await withDevMemoryFallback(
    async () => {
      await recordStoredFailureForKey(ipKey, MAX_FAILURES_PER_IP, now);
      await recordStoredFailureForKey(accKey, MAX_FAILURES_PER_ACCOUNT, now);
    },
    () => {
      recordFailureForKey(ipKey, MAX_FAILURES_PER_IP, now);
      recordFailureForKey(accKey, MAX_FAILURES_PER_ACCOUNT, now);
    },
  );
}

export async function clearFailedLoginAttempts(accountKey: string, ipAddress: string) {
  const { ipKey, accountKey: accKey } = buildKeys(accountKey, ipAddress);

  await withDevMemoryFallback(
    async () => {
      await clearStoredKey(ipKey);
      await clearStoredKey(accKey);
    },
    () => {
      clearKey(ipKey);
      clearKey(accKey);
    },
  );
}
