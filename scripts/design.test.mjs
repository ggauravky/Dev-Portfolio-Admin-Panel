import assert from "node:assert/strict";
import { test } from "node:test";
import { checkStyles, contrast } from "./check-design.mjs";

test("design guard detects legacy Tailwind treatments", () => {
  const result = checkStyles("src/example.jsx", '<div className="bg-gradient-to-r hover:text-blue-600 rounded-xl animate-pulse shadow-lg" />');
  assert.equal(result.length, 5);
  assert.ok(result.every(({ line }) => line === 1));
});

test("design guard rejects literal CSS colors and allows centralized semantics", () => {
  assert.equal(checkStyles("src/example.css", ".box { color: #ffaacc; border-radius: 14px; }").length, 2);
  assert.deepEqual(checkStyles("src/example.css", ".box { color: rgb(var(--error)); border-radius: var(--radius-control); }"), []);
  assert.deepEqual(checkStyles("src/example.jsx", '<p className="text-error">Order 500 and status pending</p>'), []);
  assert.ok(contrast("198 244 50", "14 13 11") > 15);
});
