const RUSSIAN_PHONE_PREFIX = "+7";
const RUSSIAN_PHONE_LOCAL_LENGTH = 10;

function normalizeRussianPhoneDigits(value: string) {
  const digitsOnly = value.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  if (digitsOnly.startsWith("8")) {
    return `7${digitsOnly.slice(1)}`.slice(0, RUSSIAN_PHONE_LOCAL_LENGTH + 1);
  }

  if (digitsOnly.startsWith("7")) {
    return digitsOnly.slice(0, RUSSIAN_PHONE_LOCAL_LENGTH + 1);
  }

  return `7${digitsOnly}`.slice(0, RUSSIAN_PHONE_LOCAL_LENGTH + 1);
}

function getRussianLocalDigits(value: string) {
  const normalizedDigits = normalizeRussianPhoneDigits(value);

  return normalizedDigits.startsWith("7") ? normalizedDigits.slice(1) : normalizedDigits;
}

export function formatRussianPhoneInput(value: string) {
  const localDigits = getRussianLocalDigits(value);

  let formatted = RUSSIAN_PHONE_PREFIX;

  if (localDigits.length > 0) {
    formatted += ` ${localDigits.slice(0, 3)}`;
  }

  if (localDigits.length > 3) {
    formatted += ` ${localDigits.slice(3, 6)}`;
  }

  if (localDigits.length > 6) {
    formatted += ` ${localDigits.slice(6, 8)}`;
  }

  if (localDigits.length > 8) {
    formatted += ` ${localDigits.slice(8, 10)}`;
  }

  return formatted;
}

export function normalizeRussianPhoneForStorage(value: string) {
  const localDigits = getRussianLocalDigits(value);

  if (!localDigits) {
    return "";
  }

  return formatRussianPhoneInput(value);
}

export function hasCompleteRussianPhone(value: string) {
  return getRussianLocalDigits(value).length === RUSSIAN_PHONE_LOCAL_LENGTH;
}

export const RUSSIAN_PHONE_PLACEHOLDER = `${RUSSIAN_PHONE_PREFIX} 900 123 45 67`;
