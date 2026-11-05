import { TargetTemperatureQueue } from "./target-temperature.js";
import CARD_MARKUP from "./card.html";
import CARD_STYLES from "./card.css";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import packageInfo from "../package.json";

import { escapeHTML, clone } from "./ui/dom.js";
import { createPresetId } from "./presets.js";
import {
  uses12HourClock,
  displayTime,
  parseTimeInput,
  formatClockTime,
} from "./time.js";
import {
  renderTemperatureRows,
  renderDayPicker,
  renderTimeline,
  renderPeriodRows,
  renderPresetDialog,
  renderCopyDialog,
} from "./ui/renderers.js";
import { createLocalizer, resolveLanguage } from "./localize.js";
import {
  WEEKDAYS,
  PRESET_COLORS,
  validTemperature,
  minuteOfDay,
  timeOfDay,
  compileDay,
  decodeWeek,
  canonicalSchedule,
  zonedClock,
  scheduleNow,
} from "./schedule.js";

const catalogs = { en, ru };
const CARD_VERSION = packageInfo.version;

export class TRVZBControlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._day = 0;
    this._dirty = false;
    this._busy = false;
    this._targetQueue = new TargetTemperatureQueue(
      (value) => this._sendTarget(value),
      () => {
        if (this._root && this._hass) this._renderControl();
      },
      (error) =>
        this._feedback(
          this._t("command_failed", { error: error.message || String(error) }),
          true,
        ),
    );
    this._loaded = false;
    this._timeDrafts = new Map();
  }
  setConfig(config) {
    if (!config.entity?.startsWith("climate."))
      throw new Error("A climate entity is required.");
    const expanded = this._root
      ? [...this._root.querySelectorAll("details[open]")].map((el) => el.id)
      : [];
    const base = config.entity.slice("climate.".length);
    if (this._selectedEntity !== config.entity) {
      this._hasSelectedDay = false;
      this._selectedEntity = config.entity;
    }
    this._config = clone(config);
    this._ids = {
      climate: config.entity,
      timerTarget:
        config.timer_target_entity ||
        `number.${base}_timer_mode_target_temperature`,
      timerDuration:
        config.timer_duration_entity ||
        `number.${base}_temporary_mode_duration`,
      timerMode: config.timer_mode_entity || `select.${base}_temporary_mode`,
      battery: config.battery_entity || `sensor.${base}_battery`,
      source: config.source_entity || `select.${base}_temperature_sensor`,
      lock: config.lock_entity || `switch.${base}_child_lock`,
      window: config.window_entity || `switch.${base}_open_window`,
      frost:
        config.frost_entity || `number.${base}_frost_protection_temperature`,
    };
    this._scheduleIds =
      config.schedule_entities ||
      WEEKDAYS.map((day) => `text.${base}_weekly_schedule_${day}`);
    if (this._scheduleIds.length !== 7)
      throw new Error(
        "Exactly seven schedule entities are required (Monday to Sunday).",
      );
    this.shadowRoot.innerHTML = `<style>${CARD_STYLES}</style><ha-card>${CARD_MARKUP}</ha-card>`;
    this._root = this.shadowRoot.querySelector("#heating-eve-preview");
    expanded.forEach((id) => {
      const section = this._root.querySelector("#" + id);
      if (section) section.open = true;
    });
    this._root.addEventListener("click", (e) => this._click(e));
    this._root.addEventListener("change", (e) => this._change(e));
    this._root.addEventListener("input", (e) => this._input(e));
    this._root.addEventListener("keydown", (e) => this._keydown(e));
    this._loaded = false;
    this._dirty = false;
    this._timeDrafts.clear();
    this._validationMessage = "";
    this._signature = null;
    if (this._hass) this._refresh();
  }
  set hass(value) {
    this._hass = value;
    if (this._root) this._refresh();
  }
  getCardSize() {
    return 7;
  }
  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }
  connectedCallback() {
    this._timer = setInterval(() => {
      if (this._hass && this._root) this._renderControl();
    }, 30000);
  }
  disconnectedCallback() {
    clearInterval(this._timer);
  }
  _$(selector) {
    return this._root.querySelector(selector);
  }
  _t(key, values) {
    return this._localizer?.t(key, values) ?? key;
  }
  _fmt(value) {
    return Number.isFinite(value) ? `${this._localizer.number(value)} °C` : "—";
  }
  _name(preset) {
    return preset?.nameKey
      ? this._t(preset.nameKey)
      : preset?.name || this._fmt(preset?.temp);
  }
  _dayName(index, short = false) {
    return this._t(`${short ? "day_short_" : "day_"}${index}`);
  }
  _entity(key) {
    return this._hass.states[this._ids[key]];
  }
  _available(entity) {
    return !!entity && !["unknown", "unavailable"].includes(entity.state);
  }
  _clock() {
    return zonedClock(
      new Date(),
      this._hass.config?.time_zone || "Europe/Prague",
    );
  }
  _raw() {
    return this._scheduleIds.map((id) => this._hass.states[id]?.state);
  }
  _refresh() {
    const language = resolveLanguage(this._hass);
    const signature = JSON.stringify([
      this._hass.locale,
      language,
      this._hass.connected,
      ...[...Object.values(this._ids), ...this._scheduleIds].map(
        (id) => this._hass.states[id],
      ),
    ]);
    if (signature === this._signature) return;
    this._signature = signature;
    this._localizer = createLocalizer(catalogs, language);
    const raw = this._raw();
    const rawSignature = JSON.stringify(raw);
    const use12Hours = uses12HourClock(this._hass.locale);
    let redrawEditor =
      this._language !== this._localizer.language ||
      this._use12Hours !== use12Hours;
    if (this._use12Hours !== undefined && this._use12Hours !== use12Hours) {
      for (const [key, draft] of this._timeDrafts) {
        const [day, index, field] = key.split("/");
        const canonical =
          this._week?.days[Number(day)]?.periods[Number(index)]?.[field];
        if (canonical && !draft.error) {
          this._timeDrafts.set(key, {
            ...displayTime(canonical, use12Hours),
            error: null,
          });
        } else if (draft.error) {
          draft.error = use12Hours ? "invalid_time_12" : "invalid_time_24";
        }
      }
    }
    this._use12Hours = use12Hours;
    this._language = this._localizer.language;
    if (
      !this._dirty &&
      !this._busy &&
      (!this._loaded || rawSignature !== this._rawSignature)
    ) {
      try {
        this._week = decodeWeek(
          raw,
          this._config.temperatures || [],
          this._config.day_profiles,
        );
        if (!this._hasSelectedDay) {
          this._day = this._clock().day;
          this._hasSelectedDay = true;
        }
        this._loaded = true;
        this._scheduleError = null;
        this._rawSignature = rawSignature;
        this._baseline = raw.map(canonicalSchedule);
        redrawEditor = true;
      } catch (error) {
        this._scheduleError = error.message;
      }
    }
    if (this._dirty && this._week) this._validateDraft();
    this._localizeStatic();
    this._renderControl();
    if (redrawEditor || !this._editorRendered) this._renderEditor();
  }
  _localizeStatic() {
    this._root.lang = this._localizer.language;
    this._root
      .querySelectorAll("[data-i18n]")
      .forEach((el) => (el.textContent = this._t(el.dataset.i18n)));
    this._root
      .querySelectorAll("[data-i18n-aria-label]")
      .forEach((el) =>
        el.setAttribute("aria-label", this._t(el.dataset.i18nAriaLabel)),
      );
    const name =
      this._config.name ||
      this._entity("climate")?.attributes.friendly_name ||
      this._config.entity;
    this._$(".device-title").textContent = name;
    this._$(".device-name").setAttribute(
      "aria-label",
      this._t("open_history", { name }),
    );
    this._$(".ha-demo").setAttribute("aria-label", name);
    this._$("#save-status").textContent = this._t(
      this._dirty ? "unsaved" : "stored_on_valve",
    );
  }
  _renderControl() {
    if (!this._localizer) return;
    const climate = this._entity("climate");
    const available =
      this._available(climate) && this._hass.connected !== false;
    const attributes = climate?.attributes || {};
    const target = this._targetQueue.pending ?? this._reportedTarget();
    const mode = climate?.state;
    const current = attributes.current_temperature;
    this._$("#current-temperature").textContent = Number.isFinite(current)
      ? this._localizer.number(current, { minimumFractionDigits: 1 })
      : "—";
    this._$("#target-temperature").textContent =
      mode === "off" ? "—" : this._fmt(target);
    this._$("#target-down").disabled =
      !available ||
      this._busy ||
      mode === "off" ||
      target === null ||
      target <= (attributes.min_temp ?? 4);
    this._$("#target-up").disabled =
      !available ||
      this._busy ||
      mode === "off" ||
      target === null ||
      target >= (attributes.max_temp ?? 35);
    const status = !available
      ? "unavailable"
      : mode === "off"
        ? "off"
        : attributes.hvac_action === "heating"
          ? "heating"
          : attributes.hvac_action === "idle"
            ? "idle"
            : "status_unknown";
    this._$("#heating-status").innerHTML =
      `<ha-icon icon="mdi:${status === "heating" ? "fire" : mode === "off" ? "power" : "thermometer"}" aria-hidden="true"></ha-icon>${this._t(status)}`;
    this._$("#heating-status").classList.toggle(
      "is-idle",
      status !== "heating",
    );
    this._root.querySelectorAll("[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      button.disabled =
        !available ||
        this._busy ||
        this._targetQueue.pending !== null ||
        !attributes.hvac_modes?.includes(button.dataset.mode);
    });
    const battery = this._entity("battery");
    const batteryValue = this._available(battery) ? Number(battery.state) : NaN;
    this._$(".battery").innerHTML =
      `<ha-icon icon="mdi:${batteryValue <= 20 ? "battery-low" : "battery"}" aria-hidden="true"></ha-icon>${Number.isFinite(batteryValue) ? this._localizer.number(batteryValue) + "%" : "—"}`;
    this._$(".battery").classList.toggle("low", batteryValue <= 20);
    this._$(".battery").setAttribute(
      "aria-label",
      this._t("battery_value", {
        value: Number.isFinite(batteryValue)
          ? this._localizer.number(batteryValue)
          : "—",
      }),
    );
    let plan;
    try {
      plan = scheduleNow(this._raw(), this._clock());
    } catch {
      /* Unavailable schedules must not prevent manual climate control. */
    }
    const preset = (temp) =>
      this._week?.presets.find((p) => p.temp === temp) || { temp };
    const next = plan?.next;
    const nextTime = next
      ? `${next.offset ? this._dayName(next.day, true) + ", " : ""}${formatClockTime(timeOfDay(next.minute), this._use12Hours)}`
      : "";
    const override =
      mode === "auto" &&
      target !== null &&
      plan &&
      Math.abs(target - plan.active) > 0.01;
    this._$("#target-context").textContent = !available
      ? this._t("unavailable")
      : mode === "auto"
        ? override
          ? next
            ? this._t("until_then", {
                time: nextTime,
                temperature: this._fmt(next.temp),
              })
            : this._t("until_next")
          : plan
            ? this._t("scheduled_preset", {
                name: this._name(preset(plan.active)),
              })
            : this._t("schedule_unavailable")
        : mode === "heat"
          ? this._t("manual_mode")
          : this._t("frost_value", {
              temperature: this._fmt(Number(this._entity("frost")?.state)),
            });
    this._$("#next-event-label").textContent = !available
      ? this._t("unavailable")
      : mode === "auto"
        ? override
          ? this._$("#target-context").textContent
          : next
            ? `${this._t("next_period", {
                time: nextTime,
                name: this._name(preset(next.temp)),
              })} · ${this._fmt(next.temp)}`
            : this._t("constant_week")
        : mode === "heat"
          ? this._t("schedule_paused")
          : `${this._t("frost_protection")} · ${this._fmt(Number(this._entity("frost")?.state))}`;
    this._$("#next-event-detail").textContent = !available
      ? this._t("connection_required")
      : mode === "auto"
        ? override
          ? this._t("resume_next")
          : next
            ? this._t("next_temperature", { temperature: this._fmt(next.temp) })
            : plan
              ? this._t("constant_temperature", {
                  temperature: this._fmt(plan.active),
                })
              : this._t("schedule_unavailable")
        : mode === "heat"
          ? this._t("resume_auto")
          : this._t("minimum_temperature", {
              temperature: this._fmt(Number(this._entity("frost")?.state)),
            });
    this._$("#resume-schedule").hidden =
      !available || (!override && mode !== "heat");
    this._$("#resume-schedule").disabled =
      !available || this._busy || this._targetQueue.pending !== null;
    this._renderSettings();
    if (this._week)
      this._$("#schedule-summary").textContent = this._t("schedule_count", {
        count: this._week.presets.length,
      });
    this._$("#save-schedule").disabled = !this._canSave();
  }
  _renderSettings() {
    for (const [id, key] of [
      ["child-lock", "lock"],
      ["open-window", "window"],
    ]) {
      const entity = this._entity(key);
      this._$("#" + id).checked = entity?.state === "on";
      this._$("#" + id).disabled =
        this._busy ||
        !this._available(entity) ||
        this._hass.connected === false;
    }
    const source = this._entity("source");
    const select = this._$("#temperature-source");
    const options = source?.attributes.options || [];
    select.innerHTML = options
      .map(
        (value) =>
          `<option value="${escapeHTML(value)}">${escapeHTML(value === "internal" ? this._t("source_internal") : value === "external" ? this._t("source_external") : value)}</option>`,
      )
      .join("");
    select.value = source?.state;
    select.disabled =
      this._busy || !this._available(source) || this._hass.connected === false;
    const frost = this._entity("frost");
    const input = this._$("#frost-temperature");
    if (this.shadowRoot.activeElement !== input)
      input.value = this._available(frost) ? frost.state : "";
    input.min = frost?.attributes.min ?? 4;
    input.max = frost?.attributes.max ?? 35;
    input.step = frost?.attributes.step ?? 0.5;
    input.disabled =
      this._busy || !this._available(frost) || this._hass.connected === false;
    this._$("#settings-summary").textContent =
      `${source?.state === "internal" ? this._t("internal_sensor") : this._t("external_sensor")}${this._entity("lock")?.state === "on" ? " · " + this._t("dial_locked") : ""}`;
  }
  _options(id) {
    return this._week.presets
      .map(
        (p) =>
          `<option value="${escapeHTML(p.id)}" ${p.id === id ? "selected" : ""}>${escapeHTML(this._name(p))} · ${this._fmt(p.temp)}</option>`,
      )
      .join("");
  }
  _renderEditor() {
    this._editorRendered = true;
    this._root
      .querySelectorAll(
        "#add-temperature,#add-period,#copy-day,#base-temperature",
      )
      .forEach((el) => (el.disabled = !this._loaded || this._busy));
    if (!this._loaded) {
      this._editorError(this._t(this._scheduleError || "schedule_unavailable"));
      return;
    }
    const week = this._week,
      day = week.days[this._day];
    const preset = (id) => week.presets.find((p) => p.id === id);
    this._$("#temperature-list").innerHTML = renderTemperatureRows(
      week.presets,
      this._view(),
    );
    this._$("#day-picker").innerHTML = renderDayPicker(
      this._day,
      this._dayName.bind(this),
    );
    this._$("#day-title").textContent = this._dayName(this._day);
    this._$("#day-count").textContent = this._t("period_count", {
      count: day.periods.length,
    });
    this._$("#base-temperature").innerHTML = this._options(day.base);
    this._$("#timeline").style.background = preset(day.base).color;
    this._$("#timeline").innerHTML = renderTimeline(
      day,
      week.presets,
      this._name.bind(this),
    );
    this._$("#period-list").innerHTML = renderPeriodRows(
      day,
      week.presets,
      this._view(),
    );
    this._root
      .querySelectorAll(
        ".schedule-body button,.schedule-body input,.schedule-body select",
      )
      .forEach((el) => (el.disabled = this._busy));
    this._$("#save-schedule").disabled = !this._canSave();
    if (!this._hass.user?.is_admin)
      this._$("#save-status").textContent = this._t("admin_required");
  }
  _editorError(message = "") {
    this._$("#schedule-error").hidden = !message;
    this._$("#schedule-error").textContent = message;
  }
  _feedback(message = "", error = false) {
    const el = this._$(".device-feedback");
    el.hidden = !message;
    el.textContent = message;
    el.dataset.error = String(error);
  }
  _view() {
    return {
      t: this._t.bind(this),
      fmt: this._fmt.bind(this),
      name: this._name.bind(this),
      options: this._options.bind(this),
      use12Hours: this._use12Hours,
      timeDraft: (index, field) =>
        this._timeDrafts.get(this._timeKey(index, field)),
    };
  }
  _timeKey(index, field) {
    return `${this._day}/${index}/${field}`;
  }
  _canSave() {
    return (
      this._dirty &&
      this._loaded &&
      !this._busy &&
      this._targetQueue.pending === null &&
      !this._validationMessage &&
      this._hass.user?.is_admin
    );
  }
  _validateDraft() {
    const invalidTime = [...this._timeDrafts.values()].find(
      (draft) => draft.error,
    );
    this._validationMessage = invalidTime ? this._t(invalidTime.error) : "";
    if (!this._validationMessage) {
      for (const [index, day] of this._week.days.entries()) {
        try {
          compileDay(day, this._week.presets);
        } catch (error) {
          this._validationMessage = `${this._dayName(index)}: ${this._t(error.message)}`;
          break;
        }
      }
    }
    this._editorError(this._validationMessage);
  }
  _changed(renderEditor = true) {
    this._dirty = true;
    this._$("#save-status").textContent = this._t("unsaved");
    this._validateDraft();
    if (renderEditor) {
      this._renderEditor();
      this._renderControl();
    } else {
      const day = this._week.days[this._day];
      this._$("#timeline").innerHTML = renderTimeline(
        day,
        this._week.presets,
        this._name.bind(this),
      );
      this._$("#save-schedule").disabled = !this._canSave();
    }
  }
  _input(event) {
    if (!this._busy && event.target.closest(".schedule-time-field")) {
      this._updateTimeField(event.target, false);
    }
  }
  _updateTimeField(element, commit) {
    const fieldElement = element.closest(".schedule-time-field");
    const row = element.closest("[data-period]");
    const index = Number(row.dataset.period);
    const field = fieldElement.dataset.timeField;
    const input = fieldElement.querySelector("input");
    const meridiem = fieldElement.querySelector("select")?.value || "AM";
    const draft = { text: input.value, meridiem, error: null };
    try {
      const canonical = parseTimeInput(input.value, {
        use12Hours: this._use12Hours,
        meridiem,
        isEnd: field === "end",
      });
      this._week.days[this._day].periods[index][field] = canonical;
      if (commit) {
        draft.text = displayTime(canonical, this._use12Hours).text;
        input.value = draft.text;
      }
    } catch (error) {
      draft.error = error.message;
    }
    input.setAttribute("aria-invalid", String(!!draft.error));
    this._timeDrafts.set(this._timeKey(index, field), draft);
    // Do not recreate the editor while the user is typing or moving focus.
    this._changed(false);
  }
  _removePeriod(index) {
    this._week.days[this._day].periods.splice(index, 1);
    const drafts = new Map();
    for (const [key, value] of this._timeDrafts) {
      const [day, period, field] = key.split("/");
      if (Number(day) !== this._day || Number(period) < index)
        drafts.set(key, value);
      else if (Number(period) > index)
        drafts.set(`${day}/${Number(period) - 1}/${field}`, value);
    }
    this._timeDrafts = drafts;
    this._changed();
  }
  // The duration entity stores configuration, not a live countdown.
  // Use the climate setpoint to display the effective temperature after expiry.
  _timerConfigured() {
    return (
      this._entity("climate")?.state === "auto" &&
      this._entity("timerMode")?.state === "timer" &&
      Number(this._entity("timerDuration")?.state) > 0
    );
  }
  _reportedTarget() {
    const value = this._entity("climate")?.attributes.temperature;
    return Number.isFinite(value) ? value : null;
  }
  async _sendTarget(value) {
    const mode = this._entity("climate")?.state;
    if (
      !this._available(this._entity("climate")) ||
      this._hass.connected === false ||
      mode === "off"
    )
      throw new Error(this._t("connection_required"));
    if (mode === "auto") {
      const clock = this._clock();
      const next = scheduleNow(this._raw(), clock).next;
      const minutes = next
        ? Math.ceil(
            next.offset * 1440 +
              next.minute -
              clock.minute -
              (clock.second || 0) / 60,
          )
        : 0;
      if (minutes < 1 || minutes > 1440)
        throw new Error(this._t("override_duration_unavailable"));
      if (
        !this._entity("timerTarget") ||
        !this._available(this._entity("timerDuration")) ||
        !this._available(this._entity("timerMode"))
      )
        throw new Error(this._t("timer_entities_required"));
      // TRVZB changes to Manual on occupied_heating_setpoint writes. Its native
      // timer applies a separate setpoint while Auto and the schedule stay intact.
      await this._hass.callService("number", "set_value", {
        entity_id: this._ids.timerTarget,
        value,
      });
      await this._hass.callService("number", "set_value", {
        entity_id: this._ids.timerDuration,
        value: minutes,
      });
      // Selecting Timer activates it using the already-written duration.
      await this._hass.callService("select", "select_option", {
        entity_id: this._ids.timerMode,
        option: "timer",
      });
      await this._waitFor(
        () =>
          this._timerConfigured() &&
          Number(this._entity("timerDuration")?.state) === minutes &&
          Math.abs(this._entity("climate")?.attributes.temperature - value) <
            0.01,
      );
    } else {
      await this._hass.callService("climate", "set_temperature", {
        entity_id: this._ids.climate,
        temperature: value,
      });
      await this._waitFor(
        () =>
          Math.abs(this._entity("climate")?.attributes.temperature - value) <
          0.01,
      );
    }
  }
  async _waitFor(predicate, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
      if (Date.now() > deadline)
        throw new Error(this._t("confirmation_timeout"));
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  async _command(domain, service, data, predicate) {
    if (this._busy) return;
    this._busy = true;
    this._feedback(this._t("sending"));
    this._renderControl();
    try {
      if (
        domain === "climate" &&
        service === "set_hvac_mode" &&
        this._timerConfigured()
      ) {
        await this._hass.callService("number", "set_value", {
          entity_id: this._ids.timerDuration,
          value: 0,
        });
        await this._waitFor(
          () => Number(this._entity("timerDuration")?.state) === 0,
        );
      }
      await this._hass.callService(domain, service, data);
      if (predicate) await this._waitFor(predicate);
      this._feedback("");
    } catch (error) {
      this._feedback(
        this._t("command_failed", { error: error.message || String(error) }),
        true,
      );
    } finally {
      this._busy = false;
      this._signature = null;
      this._refresh();
    }
  }
  async _persistMetadata() {
    if (!this._config.dashboard || !this._config.card_id)
      throw new Error(this._t("metadata_config_required"));
    const config = await this._hass.callWS({
      type: "lovelace/config",
      url_path: this._config.dashboard,
    });
    let count = 0;
    const update = (node) => {
      if (!node || typeof node !== "object") return;
      if (
        node.type === "custom:trvzb-control-card" &&
        node.card_id === this._config.card_id
      ) {
        node.temperatures = clone(this._week.presets);
        node.day_profiles = clone(this._week.days);
        count++;
        return;
      }
      Object.values(node).forEach((value) =>
        Array.isArray(value) ? value.forEach(update) : update(value),
      );
    };
    update(config);
    if (count !== 1) throw new Error(this._t("metadata_card_missing"));
    await this._hass.callWS({
      type: "lovelace/config/save",
      url_path: this._config.dashboard,
      config,
    });
    this._config.temperatures = clone(this._week.presets);
    this._config.day_profiles = clone(this._week.days);
  }
  async _save() {
    if (
      this._busy ||
      this._targetQueue.pending !== null ||
      !this._dirty ||
      !this._hass.user?.is_admin
    )
      return;
    this._validateDraft();
    if (this._validationMessage) return;
    let desired;
    try {
      desired = this._week.days.map((day, i) => {
        try {
          return compileDay(day, this._week.presets);
        } catch (error) {
          throw new Error(this._dayName(i) + ": " + this._t(error.message));
        }
      });
      if (
        this._raw().some(
          (raw, i) => canonicalSchedule(raw) !== this._baseline[i],
        )
      )
        throw new Error(this._t("schedule_conflict"));
    } catch (error) {
      this._editorError(error.message);
      return;
    }
    this._busy = true;
    this._renderEditor();
    this._renderControl();
    this._feedback(this._t("saving"));
    let writes = 0;
    try {
      for (let i = 0; i < 7; i++)
        if (desired[i] !== this._baseline[i]) {
          const id = this._scheduleIds[i];
          await this._hass.callService("text", "set_value", {
            entity_id: id,
            value: desired[i],
          });
          writes++;
          await this._waitFor(() => {
            try {
              return (
                canonicalSchedule(this._hass.states[id]?.state) === desired[i]
              );
            } catch {
              return false;
            }
          });
        }
      await this._persistMetadata();
      this._dirty = false;
      this._loaded = false;
      this._timeDrafts.clear();
      this._feedback(this._t("saved_device"));
      this._editorError("");
    } catch (error) {
      this._feedback(
        this._t(writes ? "save_partial" : "save_failed", {
          error: error.message || String(error),
        }),
        true,
      );
    } finally {
      this._busy = false;
      this._signature = null;
      this._refresh();
      this._renderEditor();
    }
  }
  _closeDialog() {
    this._$("#dialog-layer").hidden = true;
    this._$("#dialog-layer").innerHTML = "";
    this._dialog = null;
    this._dialogTrigger?.focus();
  }
  _showPreset(id) {
    const preset = id
      ? this._week.presets.find((p) => p.id === id)
      : { name: "", temp: 20 };
    this._dialogTrigger = this.shadowRoot.activeElement;
    this._dialog = "preset";
    this._$("#dialog-layer").innerHTML = renderPresetDialog(
      preset,
      !!id && this._week.presets.length > 1,
      this._view(),
    );
    this._$("#dialog-layer").hidden = false;
    this._$("#preset-name").focus();
    this._$("#confirm-preset").onclick = () => {
      const name = this._$("#preset-name").value.trim(),
        temp = Number(this._$("#preset-temp").value);
      if (!name || !validTemperature(temp)) {
        this._$("#preset-error").hidden = false;
        this._$("#preset-error").textContent = this._t("invalid_temperature");
        return;
      }
      if (id) {
        if (name !== this._name(preset)) {
          preset.name = name;
          delete preset.nameKey;
        }
        preset.temp = temp;
      } else
        this._week.presets.push({
          id: createPresetId(this._week.presets.map((p) => p.id)),
          name,
          temp,
          color:
            PRESET_COLORS[this._week.presets.length % PRESET_COLORS.length],
        });
      this._closeDialog();
      this._changed();
    };
    if (this._$("#delete-preset"))
      this._$("#delete-preset").onclick = () => {
        if (
          this._week.days.some(
            (day) =>
              day.base === id || day.periods.some((p) => p.preset === id),
          )
        ) {
          this._$("#preset-error").hidden = false;
          this._$("#preset-error").textContent = this._t("temperature_in_use");
          return;
        }
        this._week.presets = this._week.presets.filter((p) => p.id !== id);
        this._closeDialog();
        this._changed();
      };
  }
  _showCopy() {
    this._dialogTrigger = this.shadowRoot.activeElement;
    this._dialog = "copy";
    this._$("#dialog-layer").innerHTML = renderCopyDialog(
      this._day,
      this._dayName.bind(this),
      this._t.bind(this),
    );
    this._$("#dialog-layer").hidden = false;
    this._$("#dialog-layer input")?.focus();
    this._$("#confirm-copy").onclick = () => {
      const selected = [
        ...this._root.querySelectorAll(".copy-choice input:checked"),
      ];
      if (!selected.length) return;
      selected.forEach((input) => {
        const day = Number(input.value);
        this._week.days[day] = clone(this._week.days[this._day]);
        for (const key of this._timeDrafts.keys()) {
          if (key.startsWith(`${day}/`)) this._timeDrafts.delete(key);
        }
      });
      this._closeDialog();
      this._changed();
    };
  }
  _click(event) {
    const button = event.target.closest("button");
    if (button?.hasAttribute("data-more-info")) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId: this._config.entity },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    if (!button || button.disabled || this._busy) return;
    if (button.hasAttribute("data-mode")) {
      const mode = button.dataset.mode;
      if (mode === this._entity("climate").state) return;
      this._command(
        "climate",
        "set_hvac_mode",
        { entity_id: this._ids.climate, hvac_mode: mode },
        () => this._entity("climate")?.state === mode,
      );
    } else if (button.id === "target-up" || button.id === "target-down") {
      const a = this._entity("climate").attributes;
      const current = this._targetQueue.pending ?? this._reportedTarget();
      this._feedback("");
      this._targetQueue.set(
        Math.min(
          a.max_temp ?? 35,
          Math.max(
            a.min_temp ?? 4,
            current +
              (button.id === "target-up" ? 1 : -1) *
                (a.target_temp_step ?? 0.5),
          ),
        ),
      );
    } else if (button.id === "resume-schedule") {
      const scheduled = scheduleNow(this._raw(), this._clock()).active;
      this._command(
        "climate",
        "set_hvac_mode",
        { entity_id: this._ids.climate, hvac_mode: "auto" },
        () =>
          this._entity("climate")?.state === "auto" &&
          !this._timerConfigured() &&
          Math.abs(this._reportedTarget() - scheduled) < 0.01,
      );
    } else if (button.hasAttribute("data-edit"))
      this._showPreset(button.dataset.edit);
    else if (button.id === "add-temperature") this._showPreset();
    else if (button.hasAttribute("data-day")) {
      this._day = Number(button.dataset.day);
      this._validateDraft();
      this._renderEditor();
    } else if (button.hasAttribute("data-delete-period"))
      this._removePeriod(Number(button.dataset.deletePeriod));
    else if (button.hasAttribute("data-close")) this._closeDialog();
    else if (button.hasAttribute("data-step")) {
      const input = this._$("#preset-temp");
      input.value = Math.min(
        35,
        Math.max(4, Number(input.value) + Number(button.dataset.step)),
      );
    } else if (button.id === "copy-day") this._showCopy();
    else if (button.id === "save-schedule") this._save();
    else if (button.id === "add-period") {
      const periods = this._week.days[this._day].periods;
      let start = 0;
      for (const period of [...periods].sort(
        (a, b) => minuteOfDay(a.start) - minuteOfDay(b.start),
      )) {
        if (minuteOfDay(period.start) - start >= 60) break;
        start = minuteOfDay(period.end, true);
      }
      if (start > 1380) {
        this._editorError(this._t("no_free_hour"));
        return;
      }
      periods.push({
        start: timeOfDay(start),
        end: timeOfDay(start + 60),
        preset: this._week.presets[1]?.id || this._week.presets[0].id,
      });
      this._changed();
    }
  }
  _change(event) {
    const el = event.target;
    if (this._busy) return;
    if (el.closest(".schedule-time-field")) {
      this._updateTimeField(el, true);
      return;
    }
    const switches = { "child-lock": "lock", "open-window": "window" };
    if (switches[el.id]) {
      const entity = this._ids[switches[el.id]],
        desired = el.checked ? "on" : "off";
      this._command(
        "switch",
        el.checked ? "turn_on" : "turn_off",
        { entity_id: entity },
        () => this._hass.states[entity]?.state === desired,
      );
      return;
    }
    if (el.id === "temperature-source") {
      const value = el.value;
      this._command(
        "select",
        "select_option",
        { entity_id: this._ids.source, option: value },
        () => this._entity("source")?.state === value,
      );
      return;
    }
    if (el.id === "frost-temperature") {
      const value = Number(el.value),
        a = this._entity("frost").attributes,
        step = a.step ?? 0.5;
      if (
        !Number.isFinite(value) ||
        value < (a.min ?? 4) ||
        value > (a.max ?? 35) ||
        Math.abs(value / step - Math.round(value / step)) > 0.001
      ) {
        this._renderControl();
        return;
      }
      this._command(
        "number",
        "set_value",
        { entity_id: this._ids.frost, value },
        () => Number(this._entity("frost")?.state) === value,
      );
      return;
    }
    if (el.id === "base-temperature") {
      this._week.days[this._day].base = el.value;
      this._changed();
      return;
    }
    const row = el.closest("[data-period]");
    if (row && el.dataset.field === "preset") {
      this._week.days[this._day].periods[Number(row.dataset.period)].preset =
        el.value;
      this._changed();
    }
  }
  _keydown(event) {
    if (event.key === "Escape" && this._dialog) this._closeDialog();
    if (event.key === "Tab" && this._dialog) {
      const controls = [
        ...this._$("#dialog-layer").querySelectorAll("button,input,select"),
      ].filter((el) => !el.disabled);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && this.shadowRoot.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && this.shadowRoot.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
if (!customElements.get("trvzb-control-card"))
  customElements.define("trvzb-control-card", TRVZBControlCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "trvzb-control-card",
  name: "TRVZB Control",
  description: "Unified SONOFF TRVZB control with on-device schedules.",
});
console.info(`TRVZB Control ${CARD_VERSION}`);
