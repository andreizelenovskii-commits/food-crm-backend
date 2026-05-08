import { ValidationError } from "@backend/shared/errors/app-error";
import {
  createTechCard,
  deleteTechCard,
  getTechCardById,
  getTechCardOptions,
  getTechCardProductOptions,
  getTechCards,
  updateTechCard,
} from "@backend/modules/tech-cards/tech-cards.repository";
import type { TechCardInput } from "@backend/modules/tech-cards/tech-cards.validation";

export async function fetchTechCards() {
  return getTechCards();
}

export async function fetchTechCardById(id: number) {
  return getTechCardById(id);
}

export async function fetchTechCardProductOptions() {
  return getTechCardProductOptions();
}

export async function fetchTechCardOptions() {
  return getTechCardOptions();
}

export async function addTechCard(input: TechCardInput) {
  return createTechCard(input);
}

export async function updateTechCardById(id: number, input: TechCardInput) {
  return updateTechCard(id, input);
}

export async function deleteTechCardById(id: number) {
  const deleted = await deleteTechCard(id);

  if (!deleted) {
    throw new ValidationError("Техкарта не найдена");
  }

  return true;
}
