import { normalizeRuPhoneDigits, parseLoginPhone } from "@backend/lib/phone";
import { normalizeRussianPhoneForStorage } from "@backend/shared/lib/phone";

export function employeePhoneToDisplayDigits(phone: string | null): string {
  if (!phone) {
    return "";
  }

  return normalizeRuPhoneDigits(phone);
}

export function loginPhoneToDigits(phone: string): string {
  return parseLoginPhone(phone);
}

export function loginDigitsToEmployeeDisplay(phoneDigits: string): string {
  return normalizeRussianPhoneForStorage(`+${phoneDigits}`);
}
