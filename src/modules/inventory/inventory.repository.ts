/** Публичный API репозитория склада: реализация разнесена по файлам <400 строк. */
export type { InventoryAuditResult } from "@backend/modules/inventory/inventory.repository.audit";
export { applyInventoryAudit } from "@backend/modules/inventory/inventory.repository.audit";
export * from "@backend/modules/inventory/inventory.repository.products";
export * from "@backend/modules/inventory/inventory.repository.sessions";
export * from "@backend/modules/inventory/inventory.repository.incoming-read";
export * from "@backend/modules/inventory/inventory.repository.incoming-write";
export * from "@backend/modules/inventory/inventory.repository.incoming-finalize";
export * from "@backend/modules/inventory/inventory.repository.writeoff-read";
export * from "@backend/modules/inventory/inventory.repository.writeoff-commands";
export * from "@backend/modules/inventory/inventory.repository.session-lifecycle";
