import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACCESS_PERMISSIONS,
  type AccessPermission,
} from "@backend/modules/access/access-control";

type RouteGuardExpectation = {
  file: string;
  route: string;
  guard: "authenticateRequest" | `requirePermission("${AccessPermission}")`;
};

const PROTECTED_ROUTES: RouteGuardExpectation[] = [
  { file: "src/modules/access/access.routes.ts", route: "/api/v1/access-model", guard: 'requirePermission("view_settings")' },
  { file: "src/modules/access/access.routes.ts", route: "/api/v1/access-model/:role", guard: 'requirePermission("manage_settings")' },
  { file: "src/modules/auth/auth.routes.ts", route: "/api/v1/auth/logout", guard: "authenticateRequest" },
  { file: "src/modules/auth/auth.routes.ts", route: "/api/v1/auth/me", guard: "authenticateRequest" },
  { file: "src/modules/catalog/catalog.routes.ts", route: "/api/v1/catalog", guard: 'requirePermission("view_catalog")' },
  { file: "src/modules/catalog/catalog.routes.ts", route: "/api/v1/catalog", guard: 'requirePermission("manage_catalog")' },
  { file: "src/modules/clients/clients.routes.ts", route: "/api/v1/clients", guard: 'requirePermission("view_clients")' },
  { file: "src/modules/clients/clients.routes.ts", route: "/api/v1/clients", guard: 'requirePermission("manage_clients")' },
  { file: "src/modules/dashboard/dashboard.routes.ts", route: "/api/v1/dashboard", guard: 'requirePermission("view_dashboard")' },
  { file: "src/modules/employees/employees.routes.ts", route: "/api/v1/employees", guard: 'requirePermission("view_employees")' },
  { file: "src/modules/employees/employees.routes.ts", route: "/api/v1/employees", guard: 'requirePermission("manage_employees")' },
  { file: "src/modules/inventory/inventory.routes.ts", route: "/api/v1/inventory/products", guard: 'requirePermission("view_inventory")' },
  { file: "src/modules/inventory/inventory.routes.ts", route: "/api/v1/inventory/products", guard: 'requirePermission("manage_inventory")' },
  { file: "src/modules/loyalty/loyalty.routes.ts", route: "/api/v1/loyalty", guard: 'requirePermission("view_dashboard")' },
  { file: "src/modules/orders/orders.routes.ts", route: "/api/v1/orders", guard: 'requirePermission("view_orders")' },
  { file: "src/modules/orders/orders.routes.ts", route: "/api/v1/orders", guard: 'requirePermission("manage_orders")' },
  { file: "src/modules/orders/orders.routes.ts", route: "/api/v1/orders/:orderId/status", guard: "authenticateRequest" },
  { file: "src/modules/tech-cards/tech-cards.routes.ts", route: "/api/v1/tech-cards", guard: 'requirePermission("view_inventory")' },
  { file: "src/modules/tech-cards/tech-cards.routes.ts", route: "/api/v1/tech-cards", guard: 'requirePermission("manage_inventory")' },
];

test("route permission expectations reference known permissions", () => {
  const permissions = new Set<string>(ACCESS_PERMISSIONS);

  for (const expectation of PROTECTED_ROUTES) {
    const match = expectation.guard.match(/^requirePermission\("(.+)"\)$/);
    if (match) {
      assert.equal(
        permissions.has(match[1]),
        true,
        `${expectation.route} references unknown permission ${match[1]}`,
      );
    }
  }
});

test("protected API routes keep their auth guards", () => {
  for (const expectation of PROTECTED_ROUTES) {
    const source = readFileSync(resolve(expectation.file), "utf8");

    assert.match(source, new RegExp(escapeRegExp(expectation.route)));
    assert.match(source, new RegExp(escapeRegExp(expectation.guard)));
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
