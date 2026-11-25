const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const base = "https://ggauravky.vercel.app";
const types = new Set(["about", "overview", "project", "journey", "skills", "service", "blog", "roadmap", "faq"]);
const safeId = /^[A-Za-z0-9:#_./-]{1,180}$/;

function safeSourceUrl(value) {
  if (typeof value !== "string" || !value || /[\x00-\x20\\]/.test(value) || (!value.startsWith("https://") && !/^\/(?!\/)/.test(value))) return null;
  try {
    const url = new URL(value, base);
    if (url.username || url.password) return null;
    if (url.origin === base || (url.origin === "https://github.com" && /^\/ggauravky(?:\/|$)/i.test(url.pathname))) return url.href;
  } catch {}
  return null;
}

function manifestFrom(index, sourceRevision) {
  if (!/^[a-f0-9]{40}$/.test(sourceRevision) || !/^[a-f0-9]{16}$/.test(index.version) ||
      typeof index.model !== "string" || !Number.isInteger(index.dim) || !Number.isFinite(Date.parse(index.builtAt)) ||
      !Array.isArray(index.chunks) || index.chunks.length > 5000) throw new Error("Invalid corpus metadata");
  const ids = new Set();
  const chunks = index.chunks.map((chunk) => {
    if (typeof chunk.id !== "string" || !safeId.test(chunk.id) || ids.has(chunk.id) ||
        !types.has(chunk.type) || typeof chunk.title !== "string") throw new Error("Unsupported corpus entry");
    ids.add(chunk.id);
    return {
      id: chunk.id, title: chunk.title.slice(0, 220), type: chunk.type,
      group: typeof chunk.group === "string" ? chunk.group.slice(0, 180) : null,
      url: safeSourceUrl(chunk.url),
    };
  });
  return { sourceRevision, version: index.version, builtAt: index.builtAt, embeddingModel: index.model, dimensions: index.dim, chunkCount: chunks.length, chunks };
}

function generate(checkout) {
  if (!checkout) throw new Error("Provide the Portfolio checkout path");
  const git = (args) => execFileSync("git", ["-C", resolve(checkout), ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const revision = git(["rev-parse", "HEAD"]).trim();
  const index = JSON.parse(git(["show", revision + ":lib/chat/corpus-index.json"]));
  return manifestFrom(index, revision);
}

if (require.main === module) {
  try {
    const generated = generate(process.argv[2]);
    if (process.argv[3] === "--check") {
      const existing = JSON.parse(readFileSync(resolve(__dirname, "../contracts/portfolio-chat-corpus.json"), "utf8"));
      if (JSON.stringify(existing) !== JSON.stringify(generated)) throw new Error("Chat corpus manifest differs from the Portfolio checkout");
      console.log("Corpus metadata verified (" + generated.version + ")");
    } else {
      console.log(JSON.stringify(generated, null, 2));
    }
  } catch (error) {
    console.error("Corpus verification failed: " + error.message);
    process.exitCode = 1;
  }
}

module.exports = { safeSourceUrl, manifestFrom };
