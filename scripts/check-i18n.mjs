#!/usr/bin/env node
/**
 * i18n verification for the web app.
 *
 * 1. Ensures en-US.json and zh-CN.json share an identical flattened key set.
 * 2. Scans app/ and components/ for likely still-hardcoded user-visible strings.
 *
 * Usage: node scripts/check-i18n.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "apps/web/src");
const MESSAGES = join(SRC, "i18n/messages");
const LOCALES = ["en-US", "zh-CN"];

const load = (locale) => JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), "utf8"));

const flatten = (value, prefix = "", out = []) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, path, out);
    else out.push(path);
  }
  return out;
};

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
};

const en = new Set(flatten(load("en-US")));
const zh = new Set(flatten(load("zh-CN")));
const missingInZh = [...en].filter((k) => !zh.has(k)).sort();
const missingInEn = [...zh].filter((k) => !en.has(k)).sort();

const PATTERNS = [
  { name: "jsx-text", re: /(?<=>)[\s]*[A-Za-z][^<>{}]*?(?=<)/g, hint: "visible JSX text" },
  {
    name: "literal-attr",
    re: /(?:placeholder|aria-label|aria-description|title|alt)=["'][^"']*[A-Za-z][^"']*["']/g,
    hint: "hardcoded attribute copy",
  },
  { name: "native-dialog", re: /\b(confirm|alert|prompt)\(/g, hint: "native dialog" },
  {
    name: "number-format",
    re: /toFixed\(|toLocaleString\(/g,
    hint: "unlocalized number/date in UI code",
    uiOnly: true,
  },
];

// `app/api/**` builds prompts and machine values, not UI copy; counting it made
// this metric too noisy to act on, so number formatting is scoped to UI files.
const isUiFile = (file) => {
  const rel = relative(SRC, file);
  return (
    !rel.startsWith("app/api/") &&
    (rel.startsWith("app/") || rel.startsWith("components/")) &&
    /\.tsx$/.test(rel)
  );
};

const findings = {};
const byFile = {};
for (const file of walk(join(SRC, "app")).concat(
  walk(join(SRC, "components")),
  walk(join(SRC, "lib")),
)) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  for (const { name, re, uiOnly } of PATTERNS) {
    if (uiOnly && !isUiFile(file)) continue;
    const matches = text.match(new RegExp(re.source, "g"));
    if (!matches) continue;
    const kept = matches.filter((m) => {
      if (name === "number-format") {
        // CSS/animation geometry (e.g. `${angle.toFixed(3)}deg`) is not user data.
        const line = lines.find((l) => l.includes(m)) ?? "";
        return !/\bdeg\b|rotate|animation|transform/.test(line);
      }
      if (name !== "jsx-text") return true;
      // Drop JSX expressions / code that merely sit between > and <.
      const body = m.trim();
      if (/[(){};=]|&&|\|\||=>|_|\.\w/.test(body)) return false;
      return /[A-Za-z]{2}/.test(body);
    });
    if (!kept.length) continue;
    findings[name] = (findings[name] ?? 0) + kept.length;
    for (const m of kept) {
      (byFile[name] ??= []).push(
        `${relative(ROOT, file)} :: ${m.trim().replace(/\s+/g, " ").slice(0, 80)}`,
      );
    }
  }
}

const showDetail = process.argv.includes("--detail");

const formatted = missingInZh.length === 0 && missingInEn.length === 0;

console.log("i18n check");
console.log("=========");
console.log(`keys: en-US=${en.size} zh-CN=${zh.size}`);
console.log(
  `missing in zh-CN: ${missingInZh.length}${missingInZh.length ? ` → ${missingInZh.slice(0, 20).join(", ")}` : ""}`,
);
console.log(
  `missing in en-US: ${missingInEn.length}${missingInEn.length ? ` → ${missingInEn.slice(0, 20).join(", ")}` : ""}`,
);
console.log("remaining hardcoded scan:");
for (const { name, hint } of PATTERNS)
  console.log(`  ${name.padEnd(14)} ${String(findings[name] ?? 0).padStart(4)}  (${hint})`);

if (showDetail) {
  for (const { name } of PATTERNS) {
    const rows = byFile[name];
    if (!rows?.length) continue;
    console.log(`\n[${name}]`);
    for (const row of rows) console.log("  " + row);
  }
}

if (!formatted) {
  console.error("\nFAIL: en-US and zh-CN key sets differ.");
  process.exitCode = 1;
}
