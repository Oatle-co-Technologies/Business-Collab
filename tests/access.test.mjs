import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditBusiness, canViewBusiness, safeReturnPath } from "../src/lib/access.ts";

test("only the actual owner can edit; no anonymous or legacy auto-claim", () => {
  assert.equal(canEditBusiness("owner-a","owner-a"),true);
  for (const [user,owner] of [["owner-b","owner-a"],[null,"owner-a"],["owner-a",null],[null,null]]) assert.equal(canEditBusiness(user,owner),false);
});
test("drafts are private; published owned businesses are visible to signed-in members", () => {
  assert.equal(canViewBusiness("owner-a",{ownerId:"owner-a",published:false}),true);
  assert.equal(canViewBusiness("owner-b",{ownerId:"owner-a",published:false}),false);
  assert.equal(canViewBusiness(null,{ownerId:"owner-a",published:true}),false);
  assert.equal(canViewBusiness("owner-b",{ownerId:"owner-a",published:true}),true);
  assert.equal(canViewBusiness("owner-a",{ownerId:null,published:true}),false);
});
test("authentication return paths cannot redirect to another site", () => {
  assert.equal(safeReturnPath("/businesses/new"),"/businesses/new");
  for(const value of ["https://evil.example","//evil.example","/%2fexample.com","/\\example.com","/%0aexample.com",null]) assert.equal(safeReturnPath(value),"/my-businesses");
});
