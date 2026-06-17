import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_PERMISSIONS,
  getDefaultPermissionsForRole,
  getPermissionsForRole,
  hasApiPermission,
  isFullAccessRole,
} from "@backend/modules/access/access-control";

test("admin and manager have full operational permissions", () => {
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "admin", permissions: ["manage_settings"] }, "manage_settings"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Администратор", permissions: ["manage_employees"] }, "manage_employees"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Шеф повар", permissions: ["manage_inventory"] }, "manage_inventory"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Управляющий", permissions: ["manage_inventory", "manage_orders"] }, "manage_inventory"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Управляющий", permissions: ["manage_inventory", "manage_orders"] }, "manage_orders"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Старший курьер", permissions: ["manage_orders"] }, "manage_orders"), true);
});

test("full access roles are not narrowed by stale or incomplete permission arrays", () => {
  const manager = { id: 1, phone: "7", role: "Управляющий" as const, permissions: [] };

  assert.equal(isFullAccessRole(manager.role), true);
  assert.equal(hasApiPermission(manager, "view_dashboard"), true);
  assert.equal(hasApiPermission(manager, "view_inventory"), true);
  assert.equal(hasApiPermission(manager, "manage_inventory"), true);
  assert.equal(hasApiPermission(manager, "view_clients"), true);
  assert.equal(hasApiPermission(manager, "manage_clients"), true);
  assert.equal(hasApiPermission(manager, "view_orders"), true);
  assert.equal(hasApiPermission(manager, "manage_orders"), true);
});

test("getPermissionsForRole returns the full built-in set for manager", async () => {
  assert.deepEqual(await getPermissionsForRole("Управляющий"), [...ACCESS_PERMISSIONS]);
});

test("dispatcher can manage orders but cannot manage inventory", () => {
  assert.deepEqual(getDefaultPermissionsForRole("Диспетчер"), [
    "view_dashboard",
    "view_orders",
    "manage_orders",
    "view_catalog",
    "view_clients",
  ]);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Диспетчер", permissions: ["manage_orders"] }, "manage_orders"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Диспетчер", permissions: ["manage_orders"] }, "manage_inventory"), false);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Диспетчер", permissions: ["manage_orders"] }, "view_inventory"), false);
});

test("cook and courier only receive view permissions for orders", () => {
  assert.deepEqual(getDefaultPermissionsForRole("Повар"), ["view_dashboard", "view_orders"]);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Повар", permissions: ["view_dashboard", "view_orders"] }, "view_clients"), false);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Повар", permissions: ["view_dashboard", "view_orders"] }, "view_inventory"), false);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Повар", permissions: ["view_dashboard", "view_orders"] }, "manage_inventory"), false);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Курьер", permissions: ["view_dashboard", "view_orders"] }, "view_orders"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Курьер", permissions: ["view_dashboard", "view_orders"] }, "manage_orders"), false);
});

test("legacy manager role is normalized", () => {
  assert.deepEqual(getDefaultPermissionsForRole("Менеджер" as never), getDefaultPermissionsForRole("Управляющий"));
});
