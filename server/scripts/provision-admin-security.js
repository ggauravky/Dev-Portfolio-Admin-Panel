const { mongo: { MongoClient } } = require("mongoose");
const { readDatabaseConfig } = require("../config/env");
const { primaryAnchors } = require("../config/database");
const { collections, indexes, sameIndexKey, matchesSecurityIndex, verifySecurityIndexes } = require("../auth/store");

const options = { maxTimeMS: 2000 };
class ProvisioningError extends Error {}

async function missingIndexes(collection, required) {
  const actual = await collection.listIndexes(options).toArray();
  const missing = required.filter((wanted) => !actual.some((index) => matchesSecurityIndex(index, wanted)));
  if (missing.some((wanted) => actual.some((index) => sameIndexKey(index, wanted)))) {
    throw new ProvisioningError(collection.collectionName + " has a conflicting index");
  }
  if (missing.some(({ expireAfterSeconds }) => expireAfterSeconds !== undefined) &&
      await collection.findOne({}, { ...options, projection: { _id: 1 } })) {
    throw new ProvisioningError(collection.collectionName + " has existing records and is missing its TTL index");
  }
  return missing;
}

async function provisionSecurityStore(database) {
  const existing = new Map((await database.listCollections({}, {
    ...options, nameOnly: true, authorizedCollections: true,
  }).toArray()).map(({ name, type }) => [name, type]));
  if (!primaryAnchors.some((name) => existing.get(name) === "collection")) {
    throw new ProvisioningError("Target must be an existing Portfolio database with a visible business collection");
  }

  const plan = await Promise.all(Object.entries(collections).map(async ([key, name]) => {
    if (!existing.has(name)) return { name, required: indexes[key] };
    if (existing.get(name) !== "collection") throw new ProvisioningError(name + " must be an ordinary collection");
    return { name, required: indexes[key], missing: await missingIndexes(database.collection(name), indexes[key]) };
  }));

  let added = 0;
  for (let { name, required, missing } of plan) {
    const collection = database.collection(name);
    if (!missing) {
      try {
        await database.createCollection(name);
      } catch (error) {
        if (error.code !== 48) throw error;
      }
      missing = await missingIndexes(collection, required);
    }
    if (missing.length) {
      await collection.createIndexes(missing);
      added += missing.length;
    }
  }
  await verifySecurityIndexes(database);
  return added;
}

async function main() {
  const [flag, name, ...rest] = process.argv.slice(2);
  if (flag !== "--database" || !name || rest.length || !process.env.ADMIN_PROVISION_MONGODB_URI) {
    throw new ProvisioningError("Set ADMIN_PROVISION_MONGODB_URI and pass --database <existing Portfolio database>");
  }
  const { primary, connectTimeout } = readDatabaseConfig({
    PORTFOLIO_MONGODB_URI: process.env.ADMIN_PROVISION_MONGODB_URI,
    PORTFOLIO_DB_NAME: name,
  });
  const client = new MongoClient(primary.uri, { serverSelectionTimeoutMS: connectTimeout, writeConcern: { w: "majority" } });
  try {
    await client.connect();
    const added = await provisionSecurityStore(client.db(primary.name));
    console.log("Admin security collections and indexes verified. Indexes added: " + added);
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof ProvisioningError ? error.message :
    "Provisioning failed. Check the target database, connection, and operator permissions.");
  process.exitCode = 1;
});

module.exports = { provisionSecurityStore };
