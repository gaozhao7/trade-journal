"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

/** `t.has` is typed against the message keys, but codes arrive as plain strings. */
const asKey = (code: string) => code as never;

/**
 * Turn an API failure (code + server message) into localized copy.
 *
 * Resolution order:
 * 1. A stable `code` that exists in the `Errors` namespace → that copy.
 * 2. A `code` we do not know → generic localized copy. Server messages are never
 *    rendered, because an API may return English text that cannot be localized.
 * 3. No `code` at all → the caller-supplied message (already localized at the
 *    call site), or the network fallback when there is none.
 */
export const useErrorText = () => {
  const t = useTranslations("Errors");
  return useCallback(
    (message: string | null | undefined, code?: string | null) => {
      if (code) return t.has(asKey(code)) ? t(asKey(code)) : t("unexpected");
      return message && message.length > 0 ? message : t("network");
    },
    [t],
  );
};
