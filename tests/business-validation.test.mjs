import { test } from "node:test";
import assert from "node:assert/strict";
import { businessSchema } from "../src/lib/business-validation.ts";

const valid = {
  name: "Example Business", description: "We provide catering for client events.",
  location: "Johannesburg", discoveryArea: "Pretoria, Centurion & Johannesburg", categories: "Catering, Baking, Catering, ",
  email: "example@example.com", phone: "+27 (11) 555-0100", website: "", portfolio: "",
};

test("normalises categories and optional links before persistence", () => {
  const profile = businessSchema.parse(valid);
  assert.deepEqual(profile.categories, ["Catering", "Baking"]);
  assert.equal(profile.website, null);
  assert.equal(profile.portfolio, null);
});

test("rejects unsafe URL schemes on both external links", () => {
  for (const field of ["website", "portfolio"]) {
    for (const value of ["javascript:alert(1)", "data:text/html,test", "ftp://example.com"]) {
      assert.equal(businessSchema.safeParse({ ...valid, [field]: value }).success, false);
    }
    assert.equal(businessSchema.safeParse({ ...valid, [field]: "https://example.com/work" }).success, true);
  }
});

test("rejects empty category lists, invalid contacts and oversized fields", () => {
  for (const patch of [
    { categories: ", ," }, { categories: Array.from({length: 11}, (_, i) => `Category ${i}`).join(",") },
    { name: " " }, { email: "invalid" }, { phone: "not a number" }, { description: "x".repeat(2001) },
  ]) {
    assert.equal(businessSchema.safeParse({ ...valid, ...patch }).success, false);
  }
});
