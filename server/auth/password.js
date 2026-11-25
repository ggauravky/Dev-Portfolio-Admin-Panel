const argon = require("argon2");

const options = { type: argon.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 };
const maxPasswordBytes = 256;
const validPassword = (value) => typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= maxPasswordBytes;

function validHash(value) {
  return typeof value === "string" && /^\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/.test(value);
}

function hashPassword(value) {
  if (!validPassword(value)) throw new Error("Invalid password length");
  return argon.hash(value, options);
}

const verifyPassword = (hash, value) => argon.verify(hash, value);

module.exports = { hashPassword, verifyPassword, validHash, validPassword };
