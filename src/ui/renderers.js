import { escapeHTML } from "./dom.js";
import { displayTime } from "../time.js";
import { minuteOfDay, WEEKDAYS } from "../schedule.js";

export function renderTemperatureRows(presets, view) {
  return presets
    .map(
      (preset) => `
    <div class="temperature-row">
      <span class="temperature-dot" style="--preset-color:${preset.color}"></span>
      <span class="temperature-name">${escapeHTML(view.name(preset))}</span>
      <span class="temperature-value">${view.fmt(preset.temp)}</span>
      <button type="button" class="icon-button" data-edit="${escapeHTML(preset.id)}"
        aria-label="${escapeHTML(view.t("edit_named", { name: view.name(preset) }))}">
        <ha-icon icon="mdi:pencil-outline" aria-hidden="true"></ha-icon>
      </button>
    </div>
  `,
    )
    .join("");
}

export function renderDayPicker(selectedDay, dayName) {
  return WEEKDAYS.map(
    (_, index) => `
    <button type="button" data-day="${index}" aria-pressed="${index === selectedDay}"
      aria-label="${dayName(index)}">${dayName(index, true)}</button>
  `,
  ).join("");
}

export function renderTimeline(day, presets, name) {
  return day.periods
    .map((period) => {
      const start = minuteOfDay(period.start);
      const end = minuteOfDay(period.end, true);
      const preset = presets.find((item) => item.id === period.preset);
      return `
      <div class="timeline-segment"
        style="left:${start / 14.4}%;width:${Math.max(0, end - start) / 14.4}%;--preset-color:${preset.color}"
        aria-label="${escapeHTML(`${period.start}–${period.end}, ${name(preset)}`)}"></div>
    `;
    })
    .join("");
}

function renderTimeField(period, index, field, view) {
  const display = displayTime(period[field], view.use12Hours);
  const draft = view.timeDraft(index, field);
  const text = draft?.text ?? display.text;
  const meridiem = draft?.meridiem ?? display.meridiem;
  const label = view.t(field === "start" ? "period_start" : "period_end", {
    count: index + 1,
  });
  return `
    <span class="schedule-time-field" data-time-field="${field}">
      <input class="schedule-time-input" type="text" inputmode="numeric" maxlength="5"
        value="${escapeHTML(text)}" data-field="${field}"
        placeholder="${view.use12Hours ? "hh:mm" : "HH:mm"}"
        aria-label="${escapeHTML(label)}" aria-invalid="${!!draft?.error}" autocomplete="off">
      ${
        view.use12Hours
          ? `
        <select class="time-meridiem" aria-label="${escapeHTML(view.t("period_meridiem", { name: label }))}">
          <option value="AM" ${meridiem === "AM" ? "selected" : ""}>AM</option>
          <option value="PM" ${meridiem === "PM" ? "selected" : ""}>PM</option>
        </select>
      `
          : ""
      }
    </span>
  `;
}

export function renderPeriodRows(day, presets, view) {
  return day.periods
    .map((period, index) => {
      const preset = presets.find((item) => item.id === period.preset);
      return `
      <div class="period" data-period="${index}">
        <div class="period-main">
          <div class="period-times">
            ${renderTimeField(period, index, "start", view)}
            <span aria-hidden="true">—</span>
            ${renderTimeField(period, index, "end", view)}
          </div>
          <label class="period-preset">
            <span class="temperature-dot" style="--preset-color:${preset.color}"></span>
            <select data-field="preset" aria-label="${view.t("period_temperature", { count: index + 1 })}">
              ${view.options(period.preset)}
            </select>
          </label>
        </div>
        <button type="button" class="icon-button" data-delete-period="${index}"
          aria-label="${view.t("period_delete", { count: index + 1 })}">
          <ha-icon icon="mdi:close" aria-hidden="true"></ha-icon>
        </button>
      </div>
    `;
    })
    .join("");
}

export function renderPresetDialog(preset, canDelete, view) {
  const editing = !!preset.id;
  return `
    <section class="ha-dialog" role="dialog" aria-modal="true" aria-labelledby="temperature-dialog-title">
      <h3 id="temperature-dialog-title">${view.t(editing ? "edit_temperature" : "new_temperature")}</h3>
      <label class="field-label" for="preset-name">${view.t("name")}</label>
      <input class="name-input" id="preset-name" maxlength="28" placeholder="${view.t("name_placeholder")}"
        value="${escapeHTML(editing ? view.name(preset) : "")}">
      <label class="field-label" for="preset-temp">${view.t("temperature_celsius")}</label>
      <div class="temperature-stepper">
        <button type="button" class="icon-button" data-step="-0.5" aria-label="${view.t("temperature_down")}">
          <ha-icon icon="mdi:minus" aria-hidden="true"></ha-icon>
        </button>
        <input type="number" id="preset-temp" min="4" max="35" step="0.5" value="${preset.temp}">
        <button type="button" class="icon-button" data-step="0.5" aria-label="${view.t("temperature_up")}">
          <ha-icon icon="mdi:plus" aria-hidden="true"></ha-icon>
        </button>
      </div>
      <div class="error-message" id="preset-error" role="alert" hidden></div>
      <div class="dialog-actions">
        ${canDelete ? `<button type="button" class="text-button delete-button" id="delete-preset">${view.t("delete")}</button>` : ""}
        <button type="button" class="text-button" data-close>${view.t("cancel")}</button>
        <button type="button" class="primary-button" id="confirm-preset">${view.t("done")}</button>
      </div>
    </section>
  `;
}

export function renderCopyDialog(selectedDay, dayName, t) {
  return `
    <section class="ha-dialog" role="dialog" aria-modal="true" aria-labelledby="copy-title">
      <h3 id="copy-title">${t("copy_day")}</h3>
      <p class="copy-note">${t("copy_note", { day: dayName(selectedDay) })}</p>
      ${WEEKDAYS.map((_, index) =>
        index === selectedDay
          ? ""
          : `
        <label class="copy-choice">
          <input type="checkbox" value="${index}" ${selectedDay < 5 && index < 5 ? "checked" : ""}>
          <span>${dayName(index)}</span>
        </label>
      `,
      ).join("")}
      <div class="dialog-actions">
        <button type="button" class="text-button" data-close>${t("cancel")}</button>
        <button type="button" class="primary-button" id="confirm-copy">${t("copy")}</button>
      </div>
    </section>
  `;
}
