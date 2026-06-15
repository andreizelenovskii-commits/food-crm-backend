import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultPermissionsForRole,
  hasApiPermission,
} from "@backend/modules/access/access-control";

test("admin and manager have full operational permissions", () => {
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "admin", permissions: ["manage_settings"] }, "manage_settings"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Администратор", permissions: ["manage_employees"] }, "manage_employees"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Шеф повар", permissions: ["manage_inventory"] }, "manage_inventory"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Управляющий", permissions: ["manage_inventory", "manage_orders"] }, "manage_inventory"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Управляющий", permissions: ["manage_inventory", "manage_orders"] }, "manage_orders"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Старший курьер", permissions: ["manage_orders"] }, "manage_orders"), true);
});

test("dispatcher can manage orders but cannot manage inventory", () => {
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Диспетчер", permissions: ["manage_orders"] }, "manage_orders"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Диспетчер", permissions: ["manage_orders"] }, "manage_inventory"), false);
});

test("cook and courier only receive view permissions for orders", () => {
  assert.deepEqual(getDefaultPermissionsForRole("Повар"), ["view_dashboard", "view_orders"]);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Курьер", permissions: ["view_dashboard", "view_orders"] }, "view_orders"), true);
  assert.equal(hasApiPermission({ id: 1, phone: "7", role: "Курьер", permissions: ["view_dashboard", "view_orders"] }, "manage_orders"), false);
});

test("legacy manager role is normalized", () => {
  assert.deepEqual(getDefaultPermissionsForRole("Менеджер" as never), getDefaultPermissionsForRole("Управляющий"));
});
