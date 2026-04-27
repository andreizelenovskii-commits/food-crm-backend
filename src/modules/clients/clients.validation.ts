import { ValidationError } from "@backend/shared/errors/app-error";
import {
  hasCompleteRussianPhone,
  normalizeRussianPhoneForStorage,
} from "@backend/shared/lib/phone";
import {
  CLIENT_TYPES,
  type ClientType,
} from "@backend/modules/clients/clients.types";

function normalizeInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function buildClientAddress(formData: FormData) {
  const residenceType = normalizeInput(formData.get("addressResidenceType")) || "APARTMENT";
  const city = normalizeInput(formData.get("addressCity"));
  const street = normalizeInput(formData.get("addressStreet"));
  const house = normalizeInput(formData.get("addressHouse"));
  const entrance = normalizeInput(formData.get("addressEntrance"));
  const floor = normalizeInput(formData.get("addressFloor"));
  const apartment = normalizeInput(formData.get("addressApartment"));

  const parts = [
    city ? `г. ${city}` : "",
    street ? `ул. ${street}` : "",
    house ? `д. ${house}` : "",
    residenceType === "PRIVATE_HOUSE" ? "частный дом" : "",
    residenceType === "APARTMENT" && entrance ? `подъезд ${entrance}` : "",
    residenceType === "APARTMENT" && floor ? `этаж ${floor}` : "",
    residenceType === "APARTMENT" && apartment ? `кв. ${apartment}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export type CreateClientInput = {
  name: string;
  type: ClientType;
  email: string | null;
  phone: string;
  birthDate: string | null;
  address: string | null;
  notes: string | null;
};

export type UpdateClientInput = CreateClientInput;

function isClientType(value: string): value is ClientType {
  return CLIENT_TYPES.includes(value as ClientType);
}

export function parseCreateClientInput(formData: FormData): CreateClientInput {
  const name = normalizeInput(formData.get("name"));
  const type = normalizeInput(formData.get("type"));
  const email = normalizeInput(formData.get("email"));
  const phoneInput = normalizeInput(formData.get("phone"));
  const phone = normalizeRussianPhoneForStorage(phoneInput);
  const birthDateStr = normalizeInput(formData.get("birthDate"));
  const address = buildClientAddress(formData);
  const notes = normalizeInput(formData.get("notes"));

  if (!name || !phone) {
    throw new ValidationError("Заполните имя и телефон");
  }

  if (!hasCompleteRussianPhone(phoneInput)) {
    throw new ValidationError("Введите телефон полностью в формате +7");
  }

  if (!isClientType(type)) {
    throw new ValidationError("Выберите корректный тип записи");
  }

  if (email) {
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValidEmail) {
      throw new ValidationError("Введите корректный email клиента");
    }
  }

  let birthDate: string | null = null;
  if (type === "CLIENT" && !birthDateStr) {
    throw new ValidationError("Для клиента дата рождения обязательна");
  }

  if (type === "CLIENT" && birthDateStr) {
    const parsed = new Date(`${birthDateStr}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError("Введите корректную дату рождения клиента");
    }

    birthDate = birthDateStr;
  }

  return {
    name,
    type,
    email: email || null,
    phone,
    birthDate: type === "CLIENT" ? birthDate : null,
    address,
    notes: notes || null,
  };
}

export function parseUpdateClientInput(formData: FormData): UpdateClientInput {
  return parseCreateClientInput(formData);
}
