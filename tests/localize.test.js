import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLocalizer, resolveLanguage } from "../src/localize.js";

const catalogs = Object.fromEntries(
  ["en", "ru"].map((code) => [
    code,
    JSON.parse(
      readFileSync(
        new URL(`../src/locales/${code}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);

test("HA current-user locale takes priority, with English as default", () => {
  assert.equal(resolveLanguage(), "en");
  assert.equal(resolveLanguage({ language: "ru" }), "ru");
  assert.equal(
    resolveLanguage({ locale: { language: "en-GB" }, language: "ru" }),
    "en-GB",
  );
  assert.equal(
    createLocalizer(
      catalogs,
      resolveLanguage({ locale: { language: "ru-RU" } }),
    ).language,
    "ru",
  );
});

test("unsupported languages and missing translations fall back to English", () => {
  assert.equal(createLocalizer(catalogs, "de-DE").t("schedule"), "Schedule");
  assert.equal(createLocalizer(catalogs, "RU_ru").t("schedule"), "Расписание");
  const fallback = createLocalizer({ en: catalogs.en, ru: {} }, "ru");
  assert.equal(fallback.t("period_count", { count: 2 }), "2 time slots");
  assert.equal(fallback.t("unknown-key"), "unknown-key");
});

test("localized decimal separators and plural forms", () => {
  const en = createLocalizer(catalogs, "en");
  const ru = createLocalizer(catalogs, "ru");
  assert.equal(en.number(19.8), "19.8");
  assert.equal(ru.number(19.8), "19,8");
  assert.equal(en.t("period_count", { count: 1 }), "1 time slot");
  assert.equal(en.t("period_count", { count: 21 }), "21 time slots");
  assert.equal(ru.t("period_count", { count: 1 }), "1 интервал");
  assert.equal(ru.t("period_count", { count: 2 }), "2 интервала");
  assert.equal(ru.t("period_count", { count: 5 }), "5 интервалов");
  assert.equal(ru.t("period_count", { count: 21 }), "21 интервал");
});

test("all catalogs contain matching keys and placeholders", () => {
  assert.deepEqual(
    Object.keys(catalogs.en).sort(),
    Object.keys(catalogs.ru).sort(),
  );
  const placeholders = (value) =>
    [...new Set(JSON.stringify(value).match(/\{\w+\}/g) || [])].sort();
  for (const key of Object.keys(catalogs.en)) {
    assert.deepEqual(
      placeholders(catalogs.en[key]),
      placeholders(catalogs.ru[key]),
      key,
    );
  }
});

test("interpolation treats custom names literally", () => {
  const localize = createLocalizer(catalogs, "en");
  assert.equal(localize.t("edit_named", { name: "Утро <3" }), "Edit Утро <3");
});
