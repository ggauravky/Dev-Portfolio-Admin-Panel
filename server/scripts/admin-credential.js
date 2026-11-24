const { emitKeypressEvents } = require("node:readline");
const { randomBytes } = require("node:crypto");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");
const { hashPassword, validPassword } = require("../auth/password");

const input = process.stdin;
const output = process.stderr;

async function hidden(prompt) {
  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  const keys = [];
  let tooLong = false;
  try {
    return await new Promise((resolve, reject) => {
      function finish(callback, value) {
        input.off("keypress", keypress);
        callback(value);
      }
      function keypress(character, key = {}) {
        if (key.ctrl && key.name === "c") return finish(reject, new Error("Canceled"));
        if (key.name === "return" || key.name === "enter") {
          return tooLong ? finish(reject, new Error("Password exceeds the input limit")) : finish(resolve, keys.join(""));
        }
        if (key.name === "backspace") keys.pop();
        else if (character && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(character)) {
          if (keys.length < 256) keys.push(character);
          else tooLong = true;
        }
      }
      input.on("keypress", keypress);
    });
  } finally {
    input.setRawMode(false);
    input.pause();
    output.write("\n");
  }
}

async function main() {
  if (!input.isTTY || !output.isTTY) throw new Error("Use a local interactive terminal");
  if (process.argv.length > 3 || process.argv[2] && process.argv[2] !== "--proxy-secret") throw new Error("Unexpected argument");
  const proxy = process.argv[2] === "--proxy-secret";
  let value;
  if (proxy) {
    value = randomBytes(32).toString("hex");
  } else {
    emitKeypressEvents(input);
    const password = await hidden("New administrator password (hidden): ");
    if (!validPassword(password) || [...password].length < 14) throw new Error("Use at least 14 characters and at most 256 UTF-8 bytes");
    const repeated = await hidden("Confirm administrator password (hidden): ");
    if (password !== repeated) throw new Error("Passwords do not match");
    value = await hashPassword(password);
  }
  const key = proxy ? "ADMIN_PROXY_SECRET" : "ADMIN_PASSWORD_HASH";
  const folder = mkdtempSync(join(homedir(), ".portfolio-admin-credential-"));
  const file = join(folder, key + ".txt");
  writeFileSync(file, value + "\n", { mode: 0o600, flag: "wx" });
  output.write(key + " saved in your user directory: " + file + "\n");
  output.write("Copy it to the server-side secret settings, then remove the temporary file securely.\n");
}

main().catch((error) => {
  output.write("Credential generation failed: " + (["Canceled", "Password exceeds the input limit", "Use a local interactive terminal", "Unexpected argument", "Use at least 14 characters and at most 256 UTF-8 bytes", "Passwords do not match"].includes(error.message) ? error.message : "Check local permissions and dependencies") + "\n");
  process.exitCode = 1;
});
