#!/usr/bin/env node
/**
 * Verify that every statically referenced translation key exists in the dictionary.
 *
 * Handles same-file shadowing correctly: a `t("…")` call is resolved against the
 * nearest *preceding* `useTranslations`/`getTranslations` declaration of that
 * variable, so two components in one file no longer clash.
 *
 * Template-literal keys (`t(`a.${b}`)`) cannot be checked statically; they are
 * reported as `dynamic` so they are visible instead of silently passing.
 *
 * Usage: node scripts/check-i18n-keys.mjs [--detail]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "apps/web/src");
const messages = JSON.parse(readFileSync(join(SRC, "i18n/messages/en-US.json"), "utf8"));

const hasPath = (path) => {
  let node = messages;
  for (const part of path.split(".")) {
    if (node && typeof node === "object" && part in node) node = node[part];
    else return false;
  }
  return true;
};

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
};

const missing = [];
const dynamic = [];
const badNamespaces = new Set();
const serverApiInClient = [];
let checked = 0;

// `next-intl/server` is server-only. These file conventions ship in the client
// bundle, so `getTranslations` there throws at runtime ("not supported in Client
// Components"). `loading.tsx` hit exactly that once already.
const CLIENT_BUNDLED = /(?:^|\/)(loading|error|global-error|not-found|template|default)\.tsx$/;

for (const file of [...walk(join(SRC, "app")), ...walk(join(SRC, "components"))]) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  const usesServerApi = /from\s+"next-intl\/server"/.test(text);
  if (usesServerApi && (/^\s*["']use client["']/m.test(text) || CLIENT_BUNDLED.test(rel)))
    serverApiInClient.push(rel);

  // Every declaration keeps its offset, so shadowing resolves by position.
  const declarations = [];
  const decl =
    /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*(?:"([^"]*)")?\s*\)/g;
  for (const m of text.matchAll(decl)) {
    declarations.push({ name: m[1], namespace: m[2] ?? "", at: m.index ?? 0 });
    const top = (m[2] ?? "").split(".")[0];
    if (top && !(top in messages)) badNamespaces.add(`${rel} → "${m[2]}"`);
  }
  if (!declarations.length) continue;

  const scopeAt = (name, index) => {
    let found = null;
    for (const d of declarations) if (d.name === name && d.at < index) found = d;
    return found;
  };

  const staticCall = /\b(\w+)(?:\.(?:rich|markup|raw))?\(\s*"([^"]+)"/g;
  for (const m of text.matchAll(staticCall)) {
    const scope = scopeAt(m[1], m.index ?? 0);
    if (!scope) continue;
    checked++;
    const full = scope.namespace ? `${scope.namespace}.${m[2]}` : m[2];
    if (!hasPath(full)) missing.push(`${rel} → ${m[1]}("${m[2]}") = ${full}`);
  }

  const dynamicCall = /\b(\w+)(?:\.(?:rich|markup|raw))?\(\s*`/g;
  for (const m of text.matchAll(dynamicCall)) {
    const scope = scopeAt(m[1], m.index ?? 0);
    if (!scope) continue;
    dynamic.push(`${rel} → ${m[1]}(\`…\`) in "${scope.namespace}"`);
  }
}

console.log(`checked ${checked} static translation keys`);
console.log(`dynamic (not statically checkable): ${dynamic.length}`);

if (serverApiInClient.length) {
  console.log(`\nSERVER-ONLY API IN CLIENT CODE (${serverApiInClient.length}):`);
  for (const f of serverApiInClient)
    console.log(`  ${f} → use useTranslations, not next-intl/server`);
}
if (badNamespaces.size) {
  console.log(`\nUNKNOWN NAMESPACES (${badNamespaces.size}):`);
  for (const n of badNamespaces) console.log("  " + n);
}
if (missing.length) {
  console.log(`\nMISSING (${missing.length}):`);
  for (const m of missing) console.log("  " + m);
}
if (process.argv.includes("--detail")) {
  console.log(`\n[dynamic keys]`);
  for (const d of dynamic) console.log("  " + d);
}

if (missing.length || badNamespaces.size || serverApiInClient.length) process.exitCode = 1;
