const path = require("node:path");
const { createDatabases } = require("../config/database");
const { readDatabaseConfig } = require("../config/env");
const contract = require("../contracts/portfolio-schema.json");

const options = { maxTimeMS: 2000 };
const sampleLimit = 20;
const bsonType = (value) => {
  if (value === null) return "null";
  if (value instanceof Date) return "Date";
  if (value?._bsontype === "ObjectId") return "ObjectId";
  if (Array.isArray(value)) return "Array";
  return typeof value === "object" ? "Object" : typeof value === "number" ? "Number" :
    typeof value === "string" ? "String" : typeof value === "boolean" ? "Boolean" : "other";
};
const ordered = (value) => Array.isArray(value) ? value.map(ordered) :
  value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])])) : value;

async function attempt(operation) {
  try {
    return await operation();
  } catch {
    return { unavailable: "Permission denied or inspection limit reached" };
  }
}

async function inspectCollection(database, name, definition) {
  const collection = database.collection(name);
  const count = await attempt(() => collection.countDocuments({}, options));
  const indexes = await attempt(async () => {
    const live = await collection.listIndexes().toArray();
    return definition.indexes.map(([key, indexOptions]) => ({
      keys: Object.keys(key),
      compatible: live.some((index) => JSON.stringify(index.key) === JSON.stringify(key) &&
        ["unique", "sparse"].every((option) => Boolean(index[option]) === Boolean(indexOptions[option])) &&
        index.expireAfterSeconds === indexOptions.expireAfterSeconds &&
        JSON.stringify(ordered(index.partialFilterExpression)) === JSON.stringify(ordered(indexOptions.partialFilterExpression))),
    }));
  });
  const fields = Object.entries(definition.fields || {}).filter(([field]) => !field.includes("."));
  const sample = fields.length ? await attempt(async () => {
    const rows = await collection.find({}, { ...options, projection: Object.fromEntries(fields.map(([field]) => [field, 1])) }).limit(sampleLimit).toArray();
    const types = {};
    const potentialOrphans = {};
    for (const [field, schema] of fields) {
      types[field] = { expected: schema.type, required: schema.required,
        missing: rows.filter((row) => row[field] === undefined).length,
        observed: [...new Set(rows.filter((row) => row[field] !== undefined).map((row) => bsonType(row[field])))].sort() };
      if (!schema.ref) continue;
      const ids = [...new Map(rows.filter((row) => bsonType(row[field]) === "ObjectId").map((row) => [String(row[field]), row[field]])).values()];
      potentialOrphans[field] = ids.length ? await attempt(async () =>
        ids.length - await database.collection(schema.ref).countDocuments({ _id: { $in: ids } }, options)) : 0;
    }
    return { size: rows.length, types, potentialOrphans };
  }) : { size: 0 };
  return { count, indexes, sample };
}

async function inspect(db, config) {
  const report = { revision: contract.revision, sampleLimit, dependencies: {} };
  for (const key of ["primary", "chat"]) {
    await db.connect(key);
    const database = db.get(key);
    const result = { status: db.status()[key], identityMatches: database ? database.databaseName === config[key]?.name : null };
    report.dependencies[key] = result;
    if (!database) continue;
    const available = await attempt(() => database.listCollections({}, { ...options, nameOnly: true, authorizedCollections: true }).toArray());
    if (!Array.isArray(available)) {
      result.inventory = available;
      continue;
    }
    const names = new Set(available.map(({ name }) => name));
    result.collections = {};
    for (const [name, definition] of Object.entries(contract.collections)) {
      if (definition.database !== key) continue;
      result.collections[name] = names.has(name) ? await inspectCollection(database, name, definition) : { present: "missing or not authorized" };
    }
    result.legacy = contract.legacy.filter((name) => names.has(name));
  }
  return report;
}

async function main() {
  if (process.argv[2] !== "--confirm-read-only") throw new Error("Explicitly pass --confirm-read-only");
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
  const config = readDatabaseConfig();
  if (config.dnsServers.length) require("node:dns").setServers(config.dnsServers);
  const db = createDatabases(config);
  try {
    const report = await inspect(db, config);
    console.log(JSON.stringify(report, null, 2));
    if (report.dependencies.primary.status !== "available" || report.dependencies.chat.status === "unavailable") process.exitCode = 1;
  } finally {
    await db.close();
  }
}

if (require.main === module) main().catch(() => {
  console.error("Inspection failed. Check the explicit flag, database configuration and read permissions.");
  process.exitCode = 1;
});

module.exports = { inspect };
