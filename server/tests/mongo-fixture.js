const { randomUUID } = require("node:crypto");
const { mongo: { MongoClient } } = require("mongoose");
const { collections, indexes } = require("../auth/store");
const { fixtureConfig } = require("./auth-fixture");

// This helper only connects to the designated standalone loopback test server.
async function createMongoFixture(extra = {}) {
  const uri = "mongodb://127.0.0.1:39173";
  const prefix = "admin_phase3_" + randomUUID().replaceAll("-", "");
  const adminName = prefix + "_security";
  const primaryName = prefix + "_portfolio";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
  await client.connect();
  try {
    const security = client.db(adminName);
    const primary = client.db(primaryName);
    await primary.createCollection("contacts");
    for (const [key, name] of Object.entries(collections)) {
      await security.createCollection(name);
      await security.collection(name).createIndexes(indexes[key]);
    }
    const config = await fixtureConfig({
      PORTFOLIO_MONGODB_URI: uri, PORTFOLIO_DB_NAME: primaryName,
      ADMIN_MONGODB_URI: uri, ADMIN_DB_NAME: adminName,
      ...extra,
    });
    return { client, security, primary, config };
  } catch (error) {
    await client.close();
    throw error;
  }
}

module.exports = { createMongoFixture };
