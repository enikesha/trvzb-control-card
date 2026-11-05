/** Read the current user's language from Home Assistant; English is the default. */
export function resolveLanguage(hass, fallback = "en") {
  return hass?.locale?.language || hass?.language || fallback;
}

/** A card-owned message catalog, independent of HA's built-in translation keys. */
export function createLocalizer(catalogs, requestedLanguage = "en") {
  const normalized = String(requestedLanguage)
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  const primary = normalized.split("-")[0];
  const language = Object.hasOwn(catalogs, primary) ? primary : "en";
  const pluralRules = new Intl.PluralRules(language);
  const englishPluralRules = new Intl.PluralRules("en");
  return {
    language,
    t(key, values = {}) {
      let message = catalogs[language]?.[key];
      let rules = pluralRules;
      if (message === undefined) {
        message = catalogs.en?.[key];
        rules = englishPluralRules;
      }
      if (message && typeof message === "object") {
        message = message[rules.select(Number(values.count))] ?? message.other;
      }
      if (typeof message !== "string") return key;
      return message.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : match,
      );
    },
    number(value, options = {}) {
      return new Intl.NumberFormat(language, {
        maximumFractionDigits: 1,
        useGrouping: false,
        ...options,
      }).format(value);
    },
  };
}
