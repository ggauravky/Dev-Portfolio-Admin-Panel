const { randomUUID } = require("node:crypto");
const { mongo: { MongoClient } } = require("mongoose");
const { fixtureConfig } = require("./auth-fixture");

// This helper only connects to the designated standalone loopback test server.
async function createMongoFixture(extra = {}) {
  const uri = "mongodb://127.0.0.1:39173";
  const primaryName = "admin_fixture_" + randomUUID().replaceAll("-", "") + "_portfolio";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
  await client.connect();
  try {
    const primary = client.db(primaryName);
    await primary.createCollection("contacts");
    const config = await fixtureConfig({ MONGO_URI: uri, PORTFOLIO_DB_NAME: primaryName, ...extra });
    return { client, primary, config };
  } catch (error) {
    await client.close();
    throw error;
  }
}

module.exports = { createMongoFixture };
