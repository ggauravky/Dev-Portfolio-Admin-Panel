const path = require("node:path");
const { readConfig } = require("./config/env");
const { createDatabases } = require("./config/database");
const { createApp } = require("./app");

function start() {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
  const log = (event) => console.log(JSON.stringify(event));
  let config;
  try {
    config = readConfig();
  } catch (error) {
    log({ event: "startup_rejected", reason: error.message });
    process.exitCode = 1;
    return;
  }
  if (config.dnsServers.length) require("node:dns").setServers(config.dnsServers);
  const db = createDatabases(config, { log });
  const server = createApp({ config, db, log }).listen(config.port);
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.once("listening", () => {
    log({ event: "server_started" });
    void Promise.all([db.connect("primary"), db.connect("chat")]);
  });
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    log({ event: "server_stopping" });
    const force = setTimeout(() => server.closeAllConnections(), 10000).unref();
    await new Promise((resolve) => server.close(resolve));
    clearTimeout(force);
    await db.close();
  }
  server.once("error", () => {
    log({ event: "listener_failed" });
    process.exitCode = 1;
    void shutdown();
  });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

if (require.main === module) start();
