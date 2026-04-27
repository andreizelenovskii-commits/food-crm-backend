import { AuthenticationError } from "@backend/shared/errors/app-error";

const WINDOW_MS = 1000 * 60 * 15;
const LOCK_MS = 1000 * 60 * 15;
const MAX_FAILURES_PER_IP = 10;
const MAX_FAILURES_PER_EMAIL = 5;

type AttemptState = {
  count: number;
  windowStartedAt: number;
  lockedUntil: number | null;
};

const attempts = new Map<string, AttemptState>();

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

function buildKeys(email: string, ipAddress: string) {
  return {
    ipKey: `ip:${ipAddress}`,
    emailKey: `email:${email}`,
  };
}

export function assertCanAttemptLogin(email: string, ipAddress: string) {
  const now = Date.now();
  const { ipKey, emailKey } = buildKeys(email, ipAddress);

  assertNotLocked(ipKey, now);
  assertNotLocked(emailKey, now);
}

export function recordFailedLoginAttempt(email: string, ipAddress: string) {
  const now = Date.now();
  const { ipKey, emailKey } = buildKeys(email, ipAddress);

  recordFailureForKey(ipKey, MAX_FAILURES_PER_IP, now);
  recordFailureForKey(emailKey, MAX_FAILURES_PER_EMAIL, now);
}

export function clearFailedLoginAttempts(email: string, ipAddress: string) {
  const { ipKey, emailKey } = buildKeys(email, ipAddress);
  clearKey(ipKey);
  clearKey(emailKey);
}
