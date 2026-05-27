import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCatalogSlug } from "@backend/modules/catalog/catalog.repository.shared";

describe("buildCatalogSlug", () => {
  it("scopes duplicate menu names by site category", () => {
    const rollSlug = buildCatalogSlug({
      name: "С тигровой креветкой",
      category: "Роллы",
      priceListType: "CLIENT",
    });
    const sushiDogSlug = buildCatalogSlug({
      name: "С тигровой креветкой",
      category: "Суши-доги",
      priceListType: "CLIENT",
    });

    assert.notEqual(rollSlug, sushiDogSlug);
    assert.equal(rollSlug, "с-тигровой-креветкой-роллы-client");
    assert.equal(sushiDogSlug, "с-тигровой-креветкой-суши-доги-client");
  });
});
