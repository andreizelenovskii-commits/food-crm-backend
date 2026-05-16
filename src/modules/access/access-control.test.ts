import test from "node:test";
import assert from "node:assert/strict";
import {
  getPermissionsForRole,
  hasApiPermission,
} from "@backend/modules/access/access-control";

test("admin and manager have full operational permissions", () => {
  assert.equal(hasApiPermission("admin", "manage_settings"), true);
  assert.equal(hasApiPermission("Управляющий", "manage_inventory"), true);
  assert.equal(hasApiPermission("Управляющий", "manage_orders"), true);
});

test("dispatcher can manage orders but cannot manage inventory", () => {
  assert.equal(hasApiPermission("Диспетчер", "manage_orders"), true);
  assert.equal(hasApiPermission("Диспетчер", "manage_inventory"), false);
});

test("cook and courier only receive view permissions for orders", () => {
  assert.deepEqual(getPermissionsForRole("Повар"), ["view_dashboard", "view_orders"]);
  assert.equal(hasApiPermission("Курьер", "view_orders"), true);
  assert.equal(hasApiPermission("Курьер", "manage_orders"), false);
});

test("legacy manager role is normalized", () => {
  assert.equal(hasApiPermission("Менеджер" as never, "manage_catalog"), true);
});
