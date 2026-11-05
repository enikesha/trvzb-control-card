/** Render the real distribution with fabricated data; no HA server or credentials. */
import { chromium } from "playwright";
import * as mdi from "@mdi/js";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { radiatorStates } from "../tests/browser/fixtures.js";

const images = new URL("../docs/images/", import.meta.url);
await mkdir(images, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 430, height: 1200 },
    deviceScaleFactor: 2,
  });
  await page.route("http://card-preview.invalid/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>TRVZB Control Card preview</title><style>
      body{margin:8px;background:#fafafa;font-family:Arial,sans-serif;--primary-color:#03a9f4;--primary-text-color:#212121;--secondary-text-color:#626262;--divider-color:#e5e5e5;--card-background-color:#fff;--secondary-background-color:#f4f4f4}
      ha-card{display:block;border:1px solid var(--divider-color);border-radius:12px;overflow:hidden}
      body.dark{background:#111;--primary-text-color:#e1e1e1;--secondary-text-color:#aaa;--divider-color:#393939;--card-background-color:#1c1c1c;--secondary-background-color:#282828}
    </style>`,
    }),
  );
  await page.goto("http://card-preview.invalid/");
  await page.evaluate(
    (paths) => {
      customElements.define(
        "ha-icon",
        class extends HTMLElement {
          static observedAttributes = ["icon"];
          connectedCallback() {
            this.draw();
          }
          attributeChangedCallback() {
            this.draw();
          }
          draw() {
            const name =
              "mdi" +
              (this.getAttribute("icon") || "")
                .replace(/^mdi:/, "")
                .split("-")
                .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
                .join("");
            this.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="currentColor"><path d="${paths[name] || ""}"/></svg>`;
          }
        },
      );
    },
    Object.fromEntries(
      Object.entries(mdi).filter(
        ([key, value]) => key.startsWith("mdi") && typeof value === "string",
      ),
    ),
  );
  await page.addScriptTag({
    path: fileURLToPath(
      new URL("../dist/trvzb-control-card.js", import.meta.url),
    ),
  });
  await page.evaluate((states) => {
    const climate = states["climate.living_room_radiator"];
    climate.state = "auto";
    climate.attributes.hvac_action = "heating";
    climate.attributes.temperature = 20;
    for (const [id, entity] of Object.entries(states))
      if (id.startsWith("text."))
        entity.state = "00:00/18 06:00/21 08:00/18 17:00/20 23:00/18";
    const card = document.createElement("trvzb-control-card");
    card.setConfig({
      entity: climate.entity_id,
      name: "Living room",
      temperatures: [
        { id: "sleep", name: "Sleep", temp: 18 },
        { id: "day", name: "Day", temp: 20 },
        { id: "comfort", name: "Comfort", temp: 21 },
      ],
    });
    card._clock = () => ({ day: 0, minute: 18 * 60, second: 0 });
    document.body.append(card);
    card.hass = {
      states,
      connected: true,
      locale: { language: "en", time_format: "24" },
      user: { is_admin: true },
      config: { time_zone: "Europe/Prague" },
      callService: async () => {
        throw Error("Preview is disconnected");
      },
      callWS: async () => {
        throw Error("Preview is disconnected");
      },
    };
  }, radiatorStates());
  const card = page.locator("trvzb-control-card");
  await card.screenshot({
    path: fileURLToPath(new URL("control-light.png", images)),
  });
  await page.evaluate(() => document.body.classList.add("dark"));
  await card.screenshot({
    path: fileURLToPath(new URL("control-dark.png", images)),
  });
  await card.locator("#schedule-section > summary").click();
  await card.locator('[data-day="0"]').click();
  await card
    .locator(".schedule-panel")
    .screenshot({
      path: fileURLToPath(new URL("schedule-editor.png", images)),
    });
  await card
    .locator(".ha-panel")
    .first()
    .screenshot({
      path: fileURLToPath(new URL("temperature-presets.png", images)),
    });
  console.log("README screenshots generated from synthetic data.");
} finally {
  await browser.close();
}
