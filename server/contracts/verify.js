const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const contract = require("./portfolio-schema.json");

function differences(checkout, fingerprints = contract.sourceFingerprints) {
  if (!checkout) throw new Error("Provide a Portfolio checkout path");
  return Object.entries(fingerprints).flatMap(([file, expected]) => {
    try {
      const source = readFileSync(resolve(checkout, file), "utf8").replace(/\r\n/g, "\n");
      return createHash("sha256").update(source).digest("hex") === expected ? [] : [file + " changed"];
    } catch {
      return [file + " missing or unreadable"];
    }
  });
}

if (require.main === module) {
  try {
    const changes = differences(process.argv[2]);
    if (changes.length) {
      console.error(changes.join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Portfolio schema and write paths match " + contract.revision);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { differences };
