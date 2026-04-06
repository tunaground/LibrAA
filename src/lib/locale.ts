export const FALLBACK_ORDER = ["en", "ja", "ko"];

export function getLocalized<T>(
  i18nMap: Record<string, T>,
  currentLocale: string,
): T | null {
  if (i18nMap[currentLocale]) return i18nMap[currentLocale];
  for (const fallback of FALLBACK_ORDER) {
    if (i18nMap[fallback]) return i18nMap[fallback];
  }
  const keys = Object.keys(i18nMap);
  return keys.length > 0 ? i18nMap[keys[0]] : null;
}

export function getLocalizedField<T>(
  i18nMap: Record<string, T>,
  field: keyof T & string,
  currentLocale: string,
): unknown {
  const localized = getLocalized(i18nMap, currentLocale);
  if (localized && localized[field] != null) return localized[field];

  for (const fallback of FALLBACK_ORDER) {
    const fb = i18nMap[fallback];
    if (fb && fb[field] != null) return fb[field];
  }

  for (const key of Object.keys(i18nMap)) {
    const entry = i18nMap[key];
    if (entry && entry[field] != null) return entry[field];
  }

  return null;
}

export function resolveLocale<T>(
  i18nMap: Record<string, T>,
  currentLocale: string,
): string {
  if (i18nMap[currentLocale]) return currentLocale;
  for (const fallback of FALLBACK_ORDER) {
    if (i18nMap[fallback]) return fallback;
  }
  const keys = Object.keys(i18nMap);
  return keys.length > 0 ? keys[0] : currentLocale;
}
