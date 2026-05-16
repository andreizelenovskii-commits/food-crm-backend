import { ValidationError } from "@backend/shared/errors/app-error";
import { parseLoginPhone } from "@backend/lib/phone";
import { normalizeRussianPhoneForStorage } from "@backend/shared/lib/phone";
import { createClient, getClientByPhone } from "@backend/modules/clients/clients.repository";
import type { Client } from "@backend/modules/clients/clients.types";
import { attachLoyaltyToClient } from "@backend/modules/loyalty/loyalty.rules";
import {
  assertCanSendCode,
  deleteLatestCode,
  storeCode,
  verifyStoredCode,
} from "@backend/modules/public-auth/public-auth.repository";
import { sendSmsCode } from "@backend/modules/public-auth/smsaero.client";
import type {
  PublicAuthPurpose,
  PublicClientProfile,
} from "@backend/modules/public-auth/public-auth.types";

type RegisterInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function parseBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("Укажите дату рождения");
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime()) || date > new Date()) {
    throw new ValidationError("Укажите корректную дату рождения");
  }

  return value;
}

export function parseRegisterInput(body: unknown): RegisterInput {
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const firstName = normalizeText(payload.firstName);
  const lastName = normalizeText(payload.lastName);
  const birthDate = parseBirthDate(normalizeText(payload.birthDate));
  const phone = parseLoginPhone(normalizeText(payload.phone));

  if (!firstName || !lastName) {
    throw new ValidationError("Укажите имя и фамилию");
  }

  return { firstName, lastName, birthDate, phone };
}

export function parsePhoneInput(body: unknown) {
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  return parseLoginPhone(normalizeText(payload.phone));
}

export function parseCodeInput(body: unknown) {
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const code = normalizeText(payload.code);

  if (!/^\d{6}$/.test(code)) {
    throw new ValidationError("Введите 6 цифр из SMS");
  }

  return code;
}

export async function requestPublicCode(phone: string, purpose: PublicAuthPurpose) {
  await assertCanSendCode(phone, purpose);
  const code = generateCode();
  await storeCode(phone, purpose, code);

  try {
    await sendSmsCode(phone, code);
  } catch (error) {
    await deleteLatestCode(phone, purpose);
    throw error;
  }
}

export async function verifyPublicCode(phone: string, purpose: PublicAuthPurpose, code: string) {
  await verifyStoredCode(phone, purpose, code);
}

export async function findPublicClientByPhone(phone: string) {
  const client = await getClientByPhone(phone);
  return client ? attachLoyaltyToClient(client) : null;
}

export async function registerPublicClient(input: RegisterInput) {
  const existing = await findPublicClientByPhone(input.phone);

  if (existing) {
    return existing;
  }

  const client = await createClient({
    name: `${input.firstName} ${input.lastName}`.trim(),
    type: "CLIENT",
    email: null,
    phone: normalizeRussianPhoneForStorage(input.phone),
    birthDate: input.birthDate,
    address: null,
    notes: "Зарегистрирован на публичном сайте",
    loyaltyLevelOverride: null,
  });

  return attachLoyaltyToClient(client);
}

export function toPublicClientProfile(client: Client): PublicClientProfile {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    birthDate: client.birthDate,
    totalSpentCents: client.totalSpentCents,
    loyaltyLevel: client.loyaltyLevel,
    loyaltyNextLevel: client.loyaltyNextLevel,
    loyaltyAmountToNextLevelCents: client.loyaltyAmountToNextLevelCents,
  };
}
