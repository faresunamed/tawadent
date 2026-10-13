"use client";

import { useParams } from "next/navigation";
import { DEFAULT_LOCALE, getDict, isLocale, type Dict, type Locale } from "./i18n";

export function useLocale(): Locale {
  const params = useParams<{ locale?: string }>();
  const l = params?.locale;
  return isLocale(l) ? l : DEFAULT_LOCALE;
}

export function useT(): { locale: Locale; t: Dict } {
  const locale = useLocale();
  return { locale, t: getDict(locale) };
}
