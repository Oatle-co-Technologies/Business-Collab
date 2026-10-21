import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiscoveryView, localVideoFilter, discoveryAreas, SUGGESTED_DISCOVERY_AREA } from "../src/lib/discovery.ts";
import { publishedBusinessFilter, parseBusinessSearch } from "../src/lib/business-search.ts";
import { businessSchema } from "../src/lib/business-validation.ts";

test("feed requires explicit area and search mode works even with blank filters", () => {
  assert.deepEqual(parseDiscoveryView({}), {area:"",searching:false,page:1});
  assert.equal(parseDiscoveryView({view:"search"}).searching, true);
  assert.equal(parseDiscoveryView({q:"baker"}).searching, true);
  assert.equal(parseDiscoveryView({area:" Pretoria,  Centurion & Johannesburg "}).area, SUGGESTED_DISCOVERY_AREA);
  assert.equal(parseDiscoveryView({page:"-1"}).page, 1);
  assert.equal(parseDiscoveryView({page:"99999999999"}).page, 1000);
});

test("local feed includes only video kinds of published businesses in selected area", () => {
  const where = localVideoFilter(SUGGESTED_DISCOVERY_AREA);
  assert.deepEqual(where.kind.in, ["INTRODUCTION","SHOWCASE"]);
  assert.equal(where.business.published, true);
  assert.equal(where.business.discoveryArea.equals, SUGGESTED_DISCOVERY_AREA);
  assert.equal(where.business.discoveryArea.mode, "insensitive");
  const search = publishedBusinessFilter(parseBusinessSearch({location:"Pretoria"}), SUGGESTED_DISCOVERY_AREA);
  assert.equal(search.discoveryArea.equals, SUGGESTED_DISCOVERY_AREA);
  assert.equal(search.published, true);
});

test("area choices are explicit, normalised and deduplicated", () => {
  assert.deepEqual(discoveryAreas(["Cape Town", "cape town", ""], "Durban").sort(), ["Cape Town", "Durban", SUGGESTED_DISCOVERY_AREA].sort());
});

test("business town and discovery area are required separately", () => {
  const valid = {name:"Test Business",description:"We provide catering services.",location:"Pretoria",discoveryArea:SUGGESTED_DISCOVERY_AREA,categories:"Catering",email:"qa@example.com",phone:"0125550100",website:"",portfolio:""};
  assert.equal(businessSchema.safeParse(valid).success,true);
  assert.equal(businessSchema.safeParse({...valid,discoveryArea:""}).success,false);
  assert.equal(businessSchema.safeParse({...valid,location:""}).success,false);
});
