import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBusinessSearch, publishedBusinessFilter } from "../src/lib/business-search.ts";
import { workCaptionSchema } from "../src/lib/business-validation.ts";

test("combined discovery filters always exclude drafts", () => {
  const filters = parseBusinessSearch({q:"  wedding  ",location:" Pretoria ",service:"Baking"});
  assert.deepEqual(filters, {query:"wedding",location:"Pretoria",service:"Baking"});
  const where = publishedBusinessFilter(filters);
  assert.equal(where.published, true);
  assert.equal(where.location.mode, "insensitive");
  assert.equal(where.categories.has, "Baking");
  assert.equal(where.OR[0].name.contains, "wedding");
});

test("repeated and oversized query parameters are bounded", () => {
  assert.equal(parseBusinessSearch({q:["first","second"]}).query, "first");
  assert.equal(parseBusinessSearch({location:"x".repeat(500)}).location.length, 160);
  const where=publishedBusinessFilter(parseBusinessSearch({}));
  assert.equal(where.published,true);assert.equal(where.owner.is.safetySuspended,false);assert.equal(where.owner.is.identityCheck.is.status,"VERIFIED");
});

test("work captions stay optional and are bounded", () => {
  assert.equal(workCaptionSchema.parse("  "), "");
  assert.equal(workCaptionSchema.parse("  We decorated this venue.  "), "We decorated this venue.");
  assert.equal(workCaptionSchema.safeParse("x".repeat(501)).success, false);
});
