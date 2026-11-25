import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export const tokensIn = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));

const looks = [
  [/\b(?:bg-gradient(?:-\w+)*|bg-clip-text|text-transparent)\b|(?:linear|radial|conic)-gradient\(/, "Gradient or gradient lettering"],
  [/\b(?:backdrop-blur|blur)-(?:sm|md|lg|xl|\d+xl|\[)/, "Decorative blur"],
  [/\b(?:bg|text|border|divide|outline|ring|fill|stroke)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/, "Use a centralized palette alias"],
  [/(?:^|[\s:"'])shadow(?:-(?!dialog\b|none\b)[\w-]+)?(?=$|[\s"'/])|box-shadow:(?!\s*(?:var\(--shadow-dialog\)|none\b))[^;]+;/, "Non-dialog shadow"],
  [/(?:^|[\s:"'])rounded(?:-(?!control\b|dialog\b|none\b)[\w-]+)?(?=$|[\s"'])|border-radius:(?!\s*(?:var\(--radius-(?:control|dialog|0)\)|0\b))[^;]+;/, "Use the 0/4/8 radius tokens"],
  [/\banimate-(?!none\b)[\w-]+|\banimation(?:-iteration-count)?:[^;]*\binfinite\b/, "Decorative animation"],
];

export function checkStyles(file, source) {
  const css = file.endsWith(".css");
  const violations = [];
  const blockComment = /\/\*[\s\S]*?\*\//g;
  const strip = (comment) => comment.replace(/[^\n]/g, " ");
  const lines = source.replace(blockComment, strip).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s*\/\//.test(line)) return;
    const values = css ? line : [...line.matchAll(/["'`]([^"'`]*(?:\b(?:bg|text|border|shadow|rounded|animate|blur|ring|outline|fill|stroke|divide|backdrop)[-\w]+)[^"'`]*)["'`]/g)].map((match) => match[1]).join(" ");
    for (const [pattern, reason] of looks) if (pattern.test(values)) violations.push({ line: index + 1, reason });
    if (!file.endsWith("/tokens.css") && /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(\s*\d/.test(values)) {
      violations.push({ line: index + 1, reason: "Hardcoded color outside tokens" });
    }
  });
  return violations;
}

export function contrast(a, b) {
  function luminance(rgb) {
    return rgb.split(" ").map((channel) => Number(channel) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  }
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const file = join(dir, item.name);
    return item.isDirectory() ? sources(file) : /\.(?:css|js|jsx)$/.test(file) ? [file] : [];
  });
}

function verifyContract(dir, contract, checkout) {
  const errors = [];
  const verifyTokens = (actual, label) => {
    for (const [name, value] of Object.entries(contract.tokens)) if (actual[name] !== value) errors.push(`${label}: --${name} differs from the Monograph contract`);
  };
  const local = tokensIn(readFileSync(join(dir, "src/styles/tokens.css"), "utf8"));
  verifyTokens(local, "Admin tokens");
  for (const surface of ["ink", "ink-raised"]) {
    for (const [names, minimum] of [[['paper', 'muted', 'error', 'warning', 'success'], 4.5], [['accent', 'boundary', 'chart-main', 'chart-secondary', 'chart-axis'], 3]]) {
      for (const name of names) if (!local[name] || contrast(local[name], local[surface]) < minimum) errors.push(`--${name} requires ${minimum}:1 against --${surface}`);
    }
  }
  const hash = (source, name) => createHash("sha256").update(name.endsWith(".woff2") ? source : source.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
  for (const [name, expected] of Object.entries(contract.assets)) {
    if (hash(readFileSync(join(dir, name)), name) !== expected) errors.push(`${name} differs from the pinned asset`);
    if (checkout && hash(readFileSync(join(checkout, name)), name) !== expected) errors.push(`${name} differs from the Portfolio checkout`);
  }
  if (checkout) {
    const current = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (current !== contract.portfolioRevision) errors.push(`Portfolio revision differs from ${contract.portfolioRevision}`);
    verifyTokens(tokensIn(readFileSync(join(checkout, "src/index.css"), "utf8")), "Portfolio tokens");
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const contract = JSON.parse(readFileSync(join(root, "scripts/monograph-contract.json"), "utf8"));
    const errors = verifyContract(root, contract, process.argv[2] === "--portfolio" ? process.argv[3] : undefined);
    for (const file of sources(join(root, "src"))) {
      const name = relative(root, file).replaceAll("\\", "/");
      for (const { line, reason } of checkStyles(name, readFileSync(file, "utf8"))) errors.push(`${name}:${line} ${reason}`);
    }
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Monograph styles, contrast, and source contract verified (${contract.portfolioRevision.slice(0, 7)})`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
