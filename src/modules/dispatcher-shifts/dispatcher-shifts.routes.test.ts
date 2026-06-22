import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/modules/dispatcher-shifts/dispatcher-shifts.routes.ts"), "utf8");

test("dispatcher shift read endpoints opt out of HTTP caching", () => {
  for (const route of [
    "/api/v1/public/ordering-status",
    "/api/v1/dispatcher/workspace",
    "/api/v1/dispatcher-shifts",
    "/api/v1/dispatcher-shifts/:shiftId",
  ]) {
    const routeIndex = source.indexOf(`app.get("${route}"`);
    assert.notEqual(routeIndex, -1, `${route} route is missing`);

    const nextRouteIndex = source.indexOf("app.", routeIndex + route.length);
    const routeSource = source.slice(routeIndex, nextRouteIndex === -1 ? undefined : nextRouteIndex);

    assert.match(routeSource, /reply\.header\("Cache-Control", NO_STORE_HEADER\)/, `${route} must use no-store`);
  }
});

test("dispatcher workspace is permission-gated for shift roles", () => {
  assert.match(
    source,
    /\/api\/v1\/dispatcher\/workspace", \{ preHandler: requirePermission\("manage_dispatcher_shift"\) \}/,
  );
});

test("shift detail endpoint is available for manager history drilldown", () => {
  assert.match(source, /\/api\/v1\/dispatcher-shifts\/:shiftId"/);
  assert.match(source, /getDispatcherShiftDetail\(user, getNumericParam\(request, "shiftId"\)\)/);
});
