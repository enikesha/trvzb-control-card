import { fileURLToPath } from "node:url";
import { radiatorStates } from "./fixtures.js";
import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      locale: "en-US",
      viewport: { width: 430, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://ha-test.invalid/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Card regression tests</title><style>body{margin:12px;font-family:Arial}ha-card{display:block}trvzb-control-card{display:block;max-width:420px}body{--primary-color:#03a9f4}</style>",
      }),
    );
    await page.goto("http://ha-test.invalid/");
    await page.addScriptTag({
      path: fileURLToPath(
        new URL("../../dist/trvzb-control-card.js", import.meta.url),
      ),
    });
    await page.evaluate((states) => {
      window.deviceWrites = [];
      window.dashboard = {
        views: [
          {
            cards: [
              {
                type: "custom:trvzb-control-card",
                entity: "climate.living_room_radiator",
                card_id: "test",
                dashboard: "dashboard-temperature",
              },
            ],
          },
        ],
      };
      const card = document.createElement("trvzb-control-card");
      card.setConfig({
        ...window.dashboard.views[0].cards[0],
        temperatures: [
          { id: "sleep", nameKey: "preset_sleep", temp: 16 },
          { id: "home", nameKey: "preset_home", temp: 19 },
        ],
      });
      const hass = {
        states,
        connected: true,
        locale: { language: "en", time_format: "language" },
        user: { is_admin: true },
        config: { time_zone: "Europe/Prague" },
      };
      hass.callService = async (...args) => {
        window.deviceWrites.push(args);
        throw Error("Device writes forbidden in this test");
      };
      hass.callWS = async (message) => {
        if (message.type === "lovelace/config")
          return structuredClone(window.dashboard);
        if (message.type === "lovelace/config/save") {
          window.dashboard = structuredClone(message.config);
          return null;
        }
        throw Error("Unexpected request");
      };
      document.body.append(card);
      window.card = card;
      window.hass = hass;
      card.hass = hass;
    }, radiatorStates());
    const card = page.locator("trvzb-control-card");
    const assert = (condition, message) => {
      if (!condition) throw Error(message);
    };
    assert(
      await page.evaluate(
        () => !isSecureContext && crypto.randomUUID === undefined,
      ),
      "Must reproduce insecure HTTP environment",
    );
    await page.evaluate(() => {
      window.moreInfoEvents = [];
      document.addEventListener("hass-more-info", (event) =>
        window.moreInfoEvents.push(event.detail.entityId),
      );
    });
    await card.locator(".device-name").click();
    await card.locator(".device-name").press("Enter");
    assert(
      await page.evaluate(
        () =>
          window.moreInfoEvents.length === 2 &&
          window.moreInfoEvents.every(
            (id) => id === "climate.living_room_radiator",
          ),
      ),
      "Header must open native entity more-info by click and keyboard",
    );
    await card.locator("#schedule-section>summary").click();
    await card.locator('[data-day="0"]').click();
    assert(
      (await card.locator('input[type="time"]').count()) === 0,
      "Native OS picker must be absent",
    );
    assert(
      (await card.locator(".time-meridiem").count()) === 0,
      "Default English HA locale must use 24h despite en-US browser",
    );
    await card.locator("#add-temperature").click();
    assert(
      (await card.locator("#preset-name").inputValue()) === "",
      "New temperature name must be blank",
    );
    await card.locator("#preset-name").fill("Morning test");
    await card.locator("#preset-temp").fill("21.5");
    await card.locator("#confirm-preset").click();
    assert(
      (await card.locator(".temperature-row").count()) === 3,
      "New preset not added on HTTP",
    );
    await card.locator("#save-schedule").click();
    await page.waitForFunction(() => !window.card._busy);
    assert(
      await page.evaluate(() =>
        window.dashboard.views[0].cards[0].temperatures.some(
          (p) => p.name === "Morning test",
        ),
      ),
      "New preset not persisted",
    );
    assert(
      await page.evaluate(() => window.deviceWrites.length === 0),
      "Unused preset must not rewrite device schedules",
    );
    const start = card.locator('[data-period="0"] [data-field="start"]');
    const end = card.locator('[data-period="0"] [data-field="end"]');
    await start.focus();
    await start.evaluate((el) => (window.originalTimeInput = el));
    await start.press("ControlOrMeta+A");
    await page.keyboard.type("11:00");
    assert(
      await start.evaluate(
        (el) =>
          el === window.originalTimeInput &&
          el.getRootNode().activeElement === el,
      ),
      "Typing recreated the input or stole focus",
    );
    await start.press("Tab");
    assert(
      await end.evaluate((el) => el.getRootNode().activeElement === el),
      "Tab must focus the existing end field",
    );
    assert(
      await card.locator("#save-schedule").isDisabled(),
      "Temporarily invalid interval must block saving",
    );
    await end.fill("12:00");
    await end.press("Tab");
    assert(
      await page.evaluate(
        () =>
          window.card._week.days[0].periods[0].start === "11:00" &&
          window.card._week.days[0].periods[0].end === "12:00",
      ),
      "Both ends could not be edited through an invalid intermediate state",
    );
    assert(
      await card.locator("#save-schedule").isEnabled(),
      "Corrected interval should become saveable",
    );
    await start.fill("25:00");
    await start.press("Tab");
    assert(
      (await start.inputValue()) === "25:00",
      "Invalid input was silently discarded",
    );
    assert(
      (await start.getAttribute("aria-invalid")) === "true",
      "Invalid time not flagged",
    );
    assert(
      await card.locator("#save-schedule").isDisabled(),
      "Invalid display value must block saving last valid model",
    );
    await page.evaluate(() => {
      window.hass.states[
        "climate.living_room_radiator"
      ].attributes.current_temperature = 20.1;
      window.card.hass = { ...window.hass };
    });
    assert(
      (await start.inputValue()) === "25:00",
      "A HA state update discarded the invalid draft",
    );
    assert(
      await start.evaluate((el) => el === window.originalTimeInput),
      "A HA state update recreated the time field",
    );
    await start.fill("11:30");
    await start.press("Tab");
    await page.evaluate(() => {
      window.hass.locale.time_format = "12";
      window.card.hass = { ...window.hass };
    });
    assert(
      (await card.locator(".time-meridiem").count()) === 4,
      "12-hour mode must have explicit AM/PM controls",
    );
    const startPeriod = card.locator(
      '[data-period="0"] [data-time-field="start"] select',
    );
    const endPeriod = card.locator(
      '[data-period="0"] [data-time-field="end"] select',
    );
    assert((await endPeriod.inputValue()) === "PM", "Noon must be PM, not AM");
    await start.fill("12:00");
    await startPeriod.selectOption("PM");
    await end.fill("12:30");
    await endPeriod.selectOption("PM");
    assert(
      await page.evaluate(
        () =>
          window.card._week.days[0].periods[0].start === "12:00" &&
          window.card._week.days[0].periods[0].end === "12:30",
      ),
      "Noon conversion failed",
    );
    await endPeriod.selectOption("AM");
    assert(
      await page.evaluate(
        () => window.card._week.days[0].periods[0].end === "00:30",
      ),
      "AM must convert to 00:30",
    );
    await end.fill("12:00");
    await end.press("Tab");
    assert(
      await page.evaluate(
        () => window.card._week.days[0].periods[0].end === "24:00",
      ),
      "Midnight end must convert to 24:00",
    );
    await end.fill("12:30");
    await endPeriod.selectOption("PM");
    await page.evaluate(() => {
      window.hass.locale.time_format = "24";
      window.card.hass = { ...window.hass };
    });
    assert(
      (await start.inputValue()) === "12:00" &&
        (await end.inputValue()) === "12:30",
      "Locale switch corrupted a valid time draft",
    );
    for (const width of [320, 430, 1280]) {
      await page.setViewportSize({ width, height: 1100 });
      assert(
        await card.evaluate(
          (el) =>
            el.shadowRoot.querySelector(".ha-demo").scrollWidth <=
            el.getBoundingClientRect().width + 1,
        ),
        "Overflow at " + width,
      );
    }

    await card.locator("#schedule-section>summary").click();
    for (const language of ["en", "ru"]) {
      for (const width of [320, 430, 1280]) {
        await page.setViewportSize({ width, height: 1100 });
        await page.evaluate((language) => {
          window.hass.locale.language = language;
          window.card.hass = { ...window.hass };
        }, language);
        const layout = await card.evaluate((c) => {
          const el = (s) => c.shadowRoot.querySelector(s);
          const rect = (s) => el(s).getBoundingClientRect();
          return {
            aligned:
              Math.abs(
                rect(".room-temperature").top - rect(".target-temperature").top,
              ) < 1,
            statusBelowRoom:
              rect("#heating-status").top >= rect(".room-temperature").bottom,
            modeBelowTarget:
              rect(".mode-picker").top >= rect(".target-temperature").bottom &&
              rect(".mode-picker").left >= rect(".target-temperature").left,
            clipped: [".setpoint-stepper", ".mode-picker"].some(
              (s) => el(s).scrollWidth > el(s).clientWidth + 1,
            ),
            height: el(".control-panel").getBoundingClientRect().height,
          };
        });
        assert(
          layout.aligned &&
            layout.statusBelowRoom &&
            layout.modeBelowTarget &&
            !layout.clipped &&
            layout.height < 220,
          `Compact layout ${language}/${width}: ${JSON.stringify(layout)}`,
        );
      }
    }
    await page.evaluate(() => {
      window.hass.locale.language = "en";
      window.card.hass = { ...window.hass };
    });
    // Delayed device confirmations must not block or lose rapid button presses.
    await page.evaluate(() => {
      window.deviceWrites = [];
      window.hass.states["climate.living_room_radiator"].state = "auto";
      window.card._clock = () => ({ day: 0, minute: 12 * 60, second: 30 });
      window.hass.callService = async (domain, service, data) => {
        window.deviceWrites.push([domain, service, data]);
        await new Promise((resolve) => setTimeout(resolve, 250));
        const entity = window.hass.states[data.entity_id];
        if (domain === "number") {
          entity.state = String(data.value);
          if (
            data.entity_id.endsWith("temporary_mode_duration") &&
            data.value === 0
          )
            window.hass.states[
              "climate.living_room_radiator"
            ].attributes.temperature = 20;
        } else if (domain === "select") {
          entity.state = data.option;
          // A TRVZB only activates its timer when selected after its duration.
          if (
            data.entity_id.endsWith("temporary_mode") &&
            Number(
              window.hass.states[
                "number.living_room_radiator_temporary_mode_duration"
              ].state,
            ) > 0
          )
            window.hass.states[
              "climate.living_room_radiator"
            ].attributes.temperature = Number(
              window.hass.states[
                "number.living_room_radiator_timer_mode_target_temperature"
              ].state,
            );
        } else if (service === "set_hvac_mode") {
          entity.state = data.hvac_mode;
          if (data.hvac_mode === "auto") entity.attributes.temperature = 16;
        } else entity.attributes.temperature = data.temperature;
        window.card.hass = { ...window.hass };
      };
      window.card.hass = { ...window.hass };
    });
    await card.locator("#target-up").evaluate((button) => {
      for (let i = 0; i < 5; i++) button.click();
    });
    assert(
      (await card.locator("#target-temperature").innerText()).includes("22.5"),
      "Rapid presses must immediately accumulate",
    );
    assert(
      await card.locator("#target-up").isEnabled(),
      "Target controls must remain enabled during confirmation",
    );
    await page.waitForFunction(() => window.deviceWrites.length > 0);
    await card.locator("#target-up").evaluate((button) => {
      button.click();
      button.click();
    });
    assert(
      (await card.locator("#target-temperature").innerText()).includes("23.5"),
      "Presses during a slow command must accumulate",
    );
    await page.waitForFunction(() => window.card._targetQueue.pending === null);
    assert(
      await page.evaluate(
        () =>
          window.hass.states["climate.living_room_radiator"].state === "auto",
      ),
      "Auto must remain Auto",
    );
    assert(
      await page.evaluate(() =>
        window.deviceWrites.every(([domain]) => domain !== "climate"),
      ),
      "Auto adjustment must use native timer, never the manual setpoint",
    );
    assert(
      await page.evaluate(
        () =>
          window.hass.states[
            "number.living_room_radiator_timer_mode_target_temperature"
          ].state === "23.5",
      ),
      "Latest target must reach native timer",
    );
    assert(
      await page.evaluate(
        () =>
          window.hass.states[
            "number.living_room_radiator_temporary_mode_duration"
          ].state === "300",
      ),
      "Timer must end at next transition, rounded to device minute precision",
    );
    assert(
      (await card.locator("#target-temperature").innerText()).includes("23.5"),
      "Card must show confirmed timer temperature instead of climate schedule temperature",
    );
    await card.locator("#resume-schedule").click();
    await page.waitForFunction(() => !window.card._busy);
    assert(
      await page.evaluate(
        () =>
          window.card._reportedTarget() === 16 &&
          window.hass.states[
            "number.living_room_radiator_temporary_mode_duration"
          ].state === "0",
      ),
      "Resume must confirm both timer cancellation and restored schedule temperature",
    );
    await card.locator("#target-up").click();
    await page.waitForFunction(() => window.card._targetQueue.pending === null);
    await page.evaluate(() => {
      // The valve restores its schedule setpoint but retains timer configuration.
      window.hass.states[
        "climate.living_room_radiator"
      ].attributes.temperature = 16;
      window.card.hass = { ...window.hass };
    });
    assert(
      (await card.locator("#target-temperature").innerText()).includes("16"),
      "Expired timer must show the restored schedule setpoint",
    );
    assert(
      await card.locator("#resume-schedule").isHidden(),
      "Stored timer duration must not make expired override appear active",
    );
    await card.locator('[data-mode="heat"]').click();
    await page.waitForFunction(() => !window.card._busy);
    assert(
      await page.evaluate(
        () =>
          window.hass.states[
            "number.living_room_radiator_temporary_mode_duration"
          ].state === "0",
      ),
      "Manual must cancel native timer",
    );
    await card.locator("#target-down").evaluate((button) => button.click());
    await page.waitForFunction(() => window.card._targetQueue.pending === null);
    assert(
      await page.evaluate(
        () =>
          window.hass.states["climate.living_room_radiator"].attributes
            .temperature === 19.5,
      ),
      "Manual must use normal setpoint",
    );
    await page.evaluate(() => {
      window.hass.callService = async () => {
        throw Error("Simulated disconnect");
      };
      window.card.hass = { ...window.hass };
    });
    await card.locator("#target-up").click();
    await page.waitForFunction(() => window.card._targetQueue.pending === null);
    assert(
      (await card.locator("#target-temperature").innerText()).includes("19.5"),
      "Failed command must roll back optimistic value: " +
        (await card.locator("#target-temperature").innerText()),
    );
    assert(
      (await card.locator(".device-feedback").innerText()).includes(
        "Simulated disconnect",
      ),
      "Device failure must be visible",
    );

    assert(errors.length === 0, errors.join("\n"));
    console.log(
      "PASS: HTTP preset creation/persistence; 24h default for automatic English locale vs en-US browser; focus stability; two-ended edits; invalid-time retention/save blocking; 12h noon/midnight; format switching; 320/430/1280 layout; native timer Auto override; immediate rapid target presses with slow confirmations; Manual timer cancellation; failure rollback; zero real device writes and JS errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
