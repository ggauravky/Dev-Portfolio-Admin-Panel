import assert from "node:assert/strict";
import { test } from "node:test";
import { aiView, financePath, linkFor, navigation, recordPaths, workspaceLocation, workspaceRoutes } from "../src/routes/workspace.js";

test("existing bookmarks, optional IDs and aliases resolve to canonical navigation", () => {
  const id = "000000000000000000000123";
  for (const entry of navigation) assert.equal(workspaceLocation(linkFor(entry)).active, entry.name);
  assert.equal(workspaceLocation(`${recordPaths.users}/${id}`).current, "location");
  assert.equal(workspaceLocation(`/admin/financial/bookings/${id}`).active, "bookings");
  assert.equal(workspaceLocation(`/admin/bookings/${id}`).crumbs.at(-1).label, "Record details");
  assert.equal(workspaceLocation(`/admin/blog-engagement/supports/${id}`).active, "blog");
  assert.equal(workspaceLocation(`/admin/security/audit/${id}`).active, "security");
  assert.equal(workspaceLocation(financePath("receipts")).active, "finance");
  assert.equal(new Set(workspaceRoutes.map(({ path }) => path)).size, workspaceRoutes.length);
});

test("AI views have stable URL fallbacks and retired or unknown URLs have no active route", () => {
  assert.equal(aiView("?view=__proto__"), "overview");
  assert.equal(workspaceLocation("/admin/chats", "?view=operations").title, "Operations");
  assert.equal(workspaceLocation("/admin/chats", "?view=conversations").active, "ai");
  for (const path of ["/admin/mllogs", "/admin/financial/no-such-view", "/admin/users/one/two"]) {
    assert.equal(workspaceLocation(path).title, "Page unavailable");
    assert.equal(workspaceLocation(path).active, undefined);
  }
});
