import { describe, expect, it } from "vitest";
import enUS from "../src/i18n/messages/en-US.json";
import zhCN from "../src/i18n/messages/zh-CN.json";

/**
 * Focused ICU MessageFormat validator.
 *
 * `intl-messageformat` is only a transitive dependency, so instead of importing it
 * we check the constructs our dictionary actually uses: balanced braces, valid
 * argument names/types, and well-formed `plural`/`select`/`selectordinal` options.
 *
 * Regression this guards: `{currency, select, '' {''} other { · {currency}}}`
 * looked like an empty-string selector but `''` is ICU's escaped apostrophe, so
 * the message had no selector at all and blew up at render time.
 */

const IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const PLURAL_KEY = /^(=\d+|zero|one|two|few|many|other)$/;
const QUOTED_KEY = /^'[^']+'$/;
const ARG_TYPES = new Set([
  "plural",
  "selectordinal",
  "select",
  "number",
  "date",
  "time",
  "duration",
]);
const OPTION_TYPES = new Set(["plural", "selectordinal", "select"]);

/** Index of the `}` matching the `{` at `open`, honouring nesting and ICU quoting. */
const matchBrace = (text: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      if (text[i + 1] === "'") {
        i++;
        continue;
      }
      i++;
      while (i < text.length) {
        if (text[i] === "'") {
          if (text[i + 1] === "'") {
            i++;
            continue;
          }
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/** Split an argument body on top-level commas. */
const splitTop = (body: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((part) => part.trim());
};

/** Read `key {block}` pairs out of a plural/select option list. */
const readOptions = (text: string): { key: string; block: string }[] => {
  const options: { key: string; block: string }[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i++;
    const open = text.indexOf("{", i);
    if (open === -1) break;
    const close = matchBrace(text, open);
    if (close === -1) break;
    options.push({ key: text.slice(i, open).trim(), block: text.slice(open + 1, close) });
    i = close + 1;
  }
  return options;
};

const scan = (text: string, where: string, errors: string[]): void => {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      if (text[i + 1] === "'") {
        i++;
        continue;
      }
      i++;
      while (i < text.length) {
        if (text[i] === "'") {
          if (text[i + 1] === "'") {
            i++;
            continue;
          }
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "}") {
      errors.push(`${where}: unexpected "}"`);
      continue;
    }
    if (ch !== "{") continue;

    const close = matchBrace(text, i);
    if (close === -1) {
      errors.push(`${where}: unbalanced "{"`);
      return;
    }
    const parts = splitTop(text.slice(i + 1, close));
    const name = parts[0] ?? "";
    if (!IDENTIFIER.test(name)) {
      errors.push(`${where}: invalid argument name ${JSON.stringify(name)}`);
      i = close;
      continue;
    }
    if (parts.length === 1) {
      i = close;
      continue;
    }
    const type = parts[1] ?? "";
    if (!ARG_TYPES.has(type)) {
      errors.push(`${where}: unknown argument type ${JSON.stringify(type)}`);
      i = close;
      continue;
    }
    if (OPTION_TYPES.has(type)) {
      const options = readOptions(parts.slice(2).join(","));
      if (!options.length) errors.push(`${where}: ${type} on {${name}} has no options`);
      if (!options.some((option) => option.key === "other"))
        errors.push(`${where}: ${type} on {${name}} is missing "other"`);
      for (const option of options) {
        const valid =
          type === "select"
            ? IDENTIFIER.test(option.key) || QUOTED_KEY.test(option.key)
            : PLURAL_KEY.test(option.key) || QUOTED_KEY.test(option.key);
        if (!valid)
          errors.push(
            `${where}: ${type} on {${name}} has invalid selector ${JSON.stringify(option.key)}`,
          );
        scan(option.block, `${where} → ${option.key}`, errors);
      }
    }
    i = close;
  }
};

const flatten = (node: unknown, path = "", out: [string, string][] = []): [string, string][] => {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node))
      flatten(value, path ? `${path}.${key}` : key, out);
  } else if (typeof node === "string") {
    out.push([path, node]);
  }
  return out;
};

const locales = { "en-US": enUS, "zh-CN": zhCN } as const;

describe("message dictionaries", () => {
  it("keeps both locales structurally in sync", () => {
    const en = flatten(enUS)
      .map(([key]) => key)
      .sort();
    const zh = flatten(zhCN)
      .map(([key]) => key)
      .sort();
    expect(zh).toEqual(en);
  });

  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}: every message is valid ICU`, () => {
      const failures: string[] = [];
      for (const [key, message] of flatten(messages)) {
        scan(message, key, failures);
      }
      expect(failures).toEqual([]);
    });
  }

  it("rejects the exact regression that shipped once", () => {
    const failures: string[] = [];
    scan("{currency, select, '' {''} other { · {currency}}}", "regression", failures);
    expect(failures.join("\n")).toMatch(/invalid selector/);
  });

  it("accepts the boolean select used for the archived empty state", () => {
    const failures: string[] = [];
    scan("{archived, select, true {archived } other {}}", "archived", failures);
    expect(failures).toEqual([]);
  });
});
