import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getOptionalEnv } from "@backend/shared/config/env";

const HASH_PREFIX = "scrypt";
const HASH_VERSION = "v3";
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 1 << 15,
  r: 8,
  p: 1,
  maxmem: 128 * 1024 * 1024,
} as const;

type ParsedPasswordHash =
  | {
      kind: "versioned";
      salt: string;
      hash: string;
      N: number;
      r: number;
      p: number;
      peppered: boolean;
    }
  | {
      kind: "legacy";
      salt: string;
      hash: string;
    };

export type PasswordVerificationResult = {
  valid: boolean;
  needsRehash: boolean;
};

export function assertStrongPassword(password: string) {
  const hasMinLength = password.length >= 12;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  if (
    !hasMinLength ||
    !hasLowercase ||
    !hasUppercase ||
    !hasDigit ||
    !hasSpecialCharacter
  ) {
    throw new Error(
      "Password must be at least 12 characters long and include uppercase, lowercase, number, and special character.",
    );
  }
}

type HashPasswordOptions = {
  validateStrength?: boolean;
};

function getPasswordPepper() {
  return getOptionalEnv("PASSWORD_PEPPER");
}

function buildPasswordSecret(password: string) {
  const pepper = getPasswordPepper();

  if (!pepper) {
    return password;
  }

  return createHmac("sha256", pepper).update(password).digest("hex");
}

function buildScryptHash(
  password: string,
  salt: string,
  options: { N: number; r: number; p: number; maxmem?: number },
) {
  return scryptSync(buildPasswordSecret(password), salt, KEY_LENGTH, options).toString("hex");
}

function parsePasswordHash(storedValue: string): ParsedPasswordHash | null {
  const segments = storedValue.split("$");

  if (segments.length === 7) {
    const [prefix, version, rawN, rawR, rawP, rawPeppered, rest] = segments;

    if (prefix !== HASH_PREFIX || version !== HASH_VERSION) {
      return null;
    }

    const [salt, hash] = rest.split(":");
    const N = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);

    if (
      !salt ||
      !hash ||
      !Number.isInteger(N) ||
      !Number.isInteger(r) ||
      !Number.isInteger(p) ||
      (rawPeppered !== "0" && rawPeppered !== "1")
    ) {
      return null;
    }

    return {
      kind: "versioned",
      salt,
      hash,
      N,
      r,
      p,
      peppered: rawPeppered === "1",
    };
  }

  if (segments.length === 6) {
    const [prefix, version, rawN, rawR, rawP, rest] = segments;

    if (prefix !== HASH_PREFIX || version !== "v2") {
      return null;
    }

    const [salt, hash] = rest.split(":");
    const N = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);

    if (!salt || !hash || !Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
      return null;
    }

    return {
      kind: "versioned",
      salt,
      hash,
      N,
      r,
      p,
      peppered: false,
    };
  }

  if (segments.length === 3) {
    const [prefix, salt, hash] = segments;

    if (prefix !== HASH_PREFIX || !salt || !hash) {
      return null;
    }

    return {
      kind: "legacy",
      salt,
      hash,
    };
  }

  return null;
}

function safeCompareHashes(storedHash: string, candidateHash: string) {
  const storedBuffer = Buffer.from(storedHash, "hex");
  const candidateBuffer = Buffer.from(candidateHash, "hex");

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, candidateBuffer);
}

function safeCompareStrings(storedValue: string, candidateValue: string) {
  const storedBuffer = Buffer.from(storedValue, "utf8");
  const candidateBuffer = Buffer.from(candidateValue, "utf8");

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, candidateBuffer);
}

export function hashPassword(
  password: string,
  options: HashPasswordOptions = {},
) {
  if (options.validateStrength) {
    assertStrongPassword(password);
  }

  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = buildScryptHash(password, salt, SCRYPT_PARAMS);
  const peppered = getPasswordPepper() ? "1" : "0";

  return `${HASH_PREFIX}$${HASH_VERSION}$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${peppered}$${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): PasswordVerificationResult {
  const parsedHash = parsePasswordHash(storedValue);

  if (!parsedHash) {
    return {
      valid: safeCompareStrings(storedValue, password),
      needsRehash: true,
    };
  }

  if (parsedHash.kind === "legacy") {
    const candidateHash = buildScryptHash(password, parsedHash.salt, {
      N: 1 << 14,
      r: 8,
      p: 1,
    });

    return {
      valid: safeCompareHashes(parsedHash.hash, candidateHash),
      needsRehash: true,
    };
  }

  const candidateHash = buildScryptHash(password, parsedHash.salt, {
    N: parsedHash.N,
    r: parsedHash.r,
    p: parsedHash.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });

  const valid = safeCompareHashes(parsedHash.hash, candidateHash);
  const needsRehash =
    parsedHash.N !== SCRYPT_PARAMS.N ||
    parsedHash.r !== SCRYPT_PARAMS.r ||
    parsedHash.p !== SCRYPT_PARAMS.p ||
    parsedHash.peppered !== Boolean(getPasswordPepper());

  return {
    valid,
    needsRehash: valid && needsRehash,
  };
}
