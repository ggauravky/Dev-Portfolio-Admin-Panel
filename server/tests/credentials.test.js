const assert = require("node:assert/strict");
const { test } = require("node:test");

test("Argon2id preserves whitespace and validates the encoded hash", async () => {
  const { hashPassword, verifyPassword, validHash } = require("../auth/password");
  const password = " fixture password with spaces ";
  const hash = await hashPassword(password);
  assert.ok(validHash(hash));
  assert.ok(await verifyPassword(hash, password));
  assert.equal(await verifyPassword(hash, password.trim()), false);
  assert.equal(validHash("invalid credential"), false);
  assert.equal(validHash(hash.replace("m=65536", "m=999999999")), false);
});
