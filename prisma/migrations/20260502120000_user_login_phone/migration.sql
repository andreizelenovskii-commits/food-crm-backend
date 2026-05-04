-- Вход в CRM по номеру телефона: колонка учётной записи.
ALTER TABLE "User" RENAME COLUMN "email" TO "phone";
