/*!
MIT License

Copyright (c) 2026 TRVZB Control Card contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(() => {
  // src/target-temperature.js
  var TargetTemperatureQueue = class {
    constructor(send, changed, failed, delay = 350) {
      this.send = send;
      this.changed = changed;
      this.failed = failed;
      this.delay = delay;
      this.pending = null;
      this.running = false;
    }
    set(value) {
      this.pending = value;
      clearTimeout(this.timer);
      this.readyAt = Date.now() + this.delay;
      this.changed();
      this.timer = setTimeout(() => this.flush(), this.delay);
    }
    async flush() {
      if (this.running || this.pending === null) return;
      this.running = true;
      try {
        while (this.pending !== null) {
          const remaining = this.readyAt - Date.now();
          if (remaining > 0)
            await new Promise((resolve) => setTimeout(resolve, remaining));
          const value = this.pending;
          await this.send(value);
          if (this.pending === value) this.pending = null;
          this.changed();
        }
      } catch (error) {
        this.pending = null;
        this.failed(error);
      } finally {
        this.running = false;
        this.changed();
      }
    }
  };

  // src/card.html
  var card_default = '<div id="heating-eve-preview">\n  <main\n    class="ha-demo"\n    aria-label="Living room radiator control"\n    data-i18n-aria-label="control_title"\n  >\n    <header class="device-header">\n      <span class="device-icon"\n        ><ha-icon icon="mdi:radiator" aria-hidden="true"></ha-icon\n      ></span>\n      <button\n        type="button"\n        class="device-name"\n        data-more-info\n        aria-haspopup="dialog"\n      >\n        <span class="device-title" data-i18n="room_name">Living room</span>\n        <span\n          ><span data-i18n="device_name">Radiator \xB7 SONOFF TRVZB</span></span\n        >\n      </button>\n      <span\n        class="battery"\n        aria-label="Battery 100 percent"\n        data-i18n-aria-label="battery_label"\n        ><ha-icon icon="mdi:battery" aria-hidden="true"></ha-icon>\u2014</span\n      >\n    </header>\n    <div class="ha-content">\n      <section\n        class="control-panel"\n        aria-label="Temperature and mode"\n        data-i18n-aria-label="temperature_and_mode"\n      >\n        <div class="temperature-grid">\n          <div class="room-temperature">\n            <span><span data-i18n="room_temperature_short">Room</span></span>\n            <div>\n              <span id="current-temperature">\u2014</span\n              ><span class="temperature-unit">\xB0C</span>\n            </div>\n          </div>\n          <div class="target-temperature">\n            <div class="setpoint-label">\n              <span data-i18n="target_temperature_short">Target</span>\n            </div>\n            <div class="setpoint-stepper">\n              <button\n                type="button"\n                class="setpoint-button"\n                id="target-down"\n                aria-label="Decrease target temperature"\n                data-i18n-aria-label="target_down"\n              >\n                <ha-icon icon="mdi:minus" aria-hidden="true"></ha-icon></button\n              ><output id="target-temperature" aria-live="polite"></output\n              ><button\n                type="button"\n                class="setpoint-button"\n                id="target-up"\n                aria-label="Increase target temperature"\n                data-i18n-aria-label="target_up"\n              >\n                <ha-icon icon="mdi:plus" aria-hidden="true"></ha-icon>\n              </button>\n            </div>\n          </div>\n        </div>\n        <div class="mode-row">\n          <span\n            class="heating-status"\n            id="heating-status"\n            aria-live="polite"\n          ></span>\n          <div\n            class="mode-picker"\n            aria-label="Radiator mode"\n            data-i18n-aria-label="device_mode"\n          >\n            <button type="button" data-mode="auto">\n              <ha-icon icon="mdi:calendar-clock" aria-hidden="true"></ha-icon\n              ><span data-i18n="mode_auto">Auto</span></button\n            ><button type="button" data-mode="heat">\n              <ha-icon\n                icon="mdi:hand-back-right-outline"\n                aria-hidden="true"\n              ></ha-icon\n              ><span data-i18n="mode_manual">Manual</span></button\n            ><button type="button" data-mode="off">\n              <ha-icon icon="mdi:power" aria-hidden="true"></ha-icon\n              ><span data-i18n="mode_off">Off</span>\n            </button>\n          </div>\n        </div>\n        <div\n          id="target-context"\n          class="target-context"\n          aria-live="polite"\n        ></div>\n        <div class="next-event">\n          <ha-icon icon="mdi:clock-outline" aria-hidden="true"></ha-icon>\n          <div>\n            <span id="next-event-label"></span\n            ><span id="next-event-detail"></span>\n          </div>\n          <button type="button" class="text-button" id="resume-schedule" hidden>\n            <span data-i18n="resume">Resume</span>\n          </button>\n        </div>\n      </section>\n      <details class="device-section" id="schedule-section">\n        <summary>\n          <ha-icon\n            icon="mdi:calendar-month-outline"\n            aria-hidden="true"\n          ></ha-icon\n          ><span\n            ><span data-i18n="schedule">Schedule</span\n            ><small id="schedule-summary"\n              ><span data-i18n="schedule_intro"\n                >Custom temperatures and time slots</span\n              ></small\n            ></span\n          ><ha-icon\n            icon="mdi:chevron-down"\n            aria-hidden="true"\n            class="disclosure-icon"\n          ></ha-icon>\n        </summary>\n        <div class="schedule-body">\n          <section class="ha-panel" aria-labelledby="temperatures-heading">\n            <div class="section-title">\n              <h3 id="temperatures-heading">\n                <span data-i18n="temperatures">Temperatures</span>\n              </h3>\n            </div>\n            <div id="temperature-list"></div>\n            <button class="text-button" id="add-temperature" type="button">\n              <ha-icon icon="mdi:plus" aria-hidden="true"></ha-icon\n              ><span data-i18n="add_temperature">Add temperature</span>\n            </button>\n          </section>\n          <section\n            class="ha-panel schedule-panel"\n            aria-labelledby="schedule-heading"\n          >\n            <div class="section-title">\n              <h3 id="schedule-heading">\n                <span data-i18n="schedule">Schedule</span>\n              </h3>\n              <button\n                class="icon-button"\n                id="copy-day"\n                type="button"\n                aria-label="Copy day"\n                data-i18n-aria-label="copy_day"\n              >\n                <ha-icon icon="mdi:content-copy" aria-hidden="true"></ha-icon>\n              </button>\n            </div>\n            <div\n              class="day-picker"\n              id="day-picker"\n              aria-label="Day of the week"\n              data-i18n-aria-label="day_of_week"\n            ></div>\n            <div class="day-title">\n              <span id="day-title"></span><span id="day-count"></span>\n            </div>\n            <div class="timeline-axis">\n              <span>00</span><span>06</span><span>12</span><span>18</span\n              ><span>24</span>\n            </div>\n            <div\n              class="timeline"\n              id="timeline"\n              aria-label="Temperatures throughout the day"\n              data-i18n-aria-label="daily_timeline"\n            ></div>\n            <label class="base-temperature"\n              ><span><span data-i18n="otherwise">At other times</span></span\n              ><select\n                id="base-temperature"\n                aria-label="Temperature outside time slots"\n                data-i18n-aria-label="base_temperature"\n              ></select\n            ></label>\n            <div id="period-list" class="period-list"></div>\n            <button class="text-button" id="add-period" type="button">\n              <ha-icon icon="mdi:plus" aria-hidden="true"></ha-icon\n              ><span data-i18n="add_period">Add time slot</span>\n            </button>\n            <div\n              id="schedule-error"\n              class="error-message"\n              role="alert"\n              hidden\n            ></div>\n          </section>\n          <div class="save-row">\n            <span id="save-status" aria-live="polite"\n              ><span data-i18n="demo_changes"\n                >Changes stay in this preview</span\n              ></span\n            ><button class="primary-button" id="save-schedule" type="button">\n              <span data-i18n="save">Save</span>\n            </button>\n          </div>\n        </div>\n      </details>\n      <details class="device-section" id="settings-section">\n        <summary>\n          <ha-icon icon="mdi:tune" aria-hidden="true"></ha-icon\n          ><span\n            ><span data-i18n="settings">Settings</span\n            ><small id="settings-summary"\n              ><span data-i18n="settings_intro"\n                >External sensor \xB7 frost protection</span\n              ></small\n            ></span\n          ><ha-icon\n            icon="mdi:chevron-down"\n            aria-hidden="true"\n            class="disclosure-icon"\n          ></ha-icon>\n        </summary>\n        <div class="settings-body">\n          <label class="setting-row"\n            ><span\n              ><span data-i18n="child_lock">Child lock</span\n              ><small\n                ><span data-i18n="child_lock_help"\n                  >Prevent accidental dial changes</span\n                ></small\n              ></span\n            ><input\n              class="ha-switch"\n              id="child-lock"\n              type="checkbox"\n              role="switch"\n          /></label>\n          <label class="setting-row"\n            ><span\n              ><span data-i18n="open_window">Open window detection</span\n              ><small\n                ><span data-i18n="open_window_help"\n                  >Pause on a rapid temperature drop</span\n                ></small\n              ></span\n            ><input\n              class="ha-switch"\n              id="open-window"\n              type="checkbox"\n              role="switch"\n          /></label>\n          <label class="setting-row"\n            ><span\n              ><span data-i18n="temperature_source"\n                >Temperature sensor</span\n              ></span\n            ><select\n              id="temperature-source"\n              aria-label="Temperature sensor"\n              data-i18n-aria-label="temperature_source"\n            >\n              <option value="external" data-i18n="source_external">\n                External\n              </option>\n              <option value="internal" data-i18n="source_internal">\n                Built-in\n              </option>\n            </select></label\n          >\n          <label class="setting-row"\n            ><span\n              ><span data-i18n="frost_protection">Frost protection</span></span\n            ><span class="numeric-setting"\n              ><input\n                id="frost-temperature"\n                type="number"\n                min="4"\n                max="10"\n                step="0.5"\n                value="7"\n                aria-label="Frost protection temperature"\n                data-i18n-aria-label="frost_temperature"\n              />\xB0C</span\n            ></label\n          >\n        </div>\n      </details>\n    </div>\n    <div class="device-feedback" role="status" aria-live="polite" hidden></div>\n    <div id="dialog-layer" class="dialog-layer" hidden></div>\n  </main>\n</div>\n';

  // src/card.css
  var card_default2 = `:host {
  display: block;
}
ha-card {
  overflow: hidden;
}
#heating-eve-preview {
  padding: 0;
}
#heating-eve-preview * {
  box-sizing: border-box;
}
#heating-eve-preview [hidden] {
  display: none !important;
}
#heating-eve-preview .ha-demo {
  --ha-background: var(--secondary-background-color, #fafafa);
  --ha-surface: var(--ha-card-background, var(--card-background-color, #fff));
  --ha-text: var(--primary-text-color, #212121);
  --ha-secondary: var(--secondary-text-color, #626262);
  --ha-divider: var(--divider-color, #e5e5e5);
  --ha-input: var(
    --input-fill-color,
    var(--secondary-background-color, #f4f4f4)
  );
  --ha-accent: var(--primary-color, #03a9f4);
  --ha-accent-foreground: var(--text-primary-color, #fff);
  --ha-selected: color-mix(in srgb, var(--ha-accent) 14%, var(--ha-surface));
  --ha-danger: var(--error-color, #db4437);
  color: var(--ha-text);
  background: var(--ha-surface);
  position: relative;
  container-type: inline-size;
  overflow: hidden;
  font: 400 14px/1.45 var(--ha-font-family-body, Roboto, Arial, sans-serif);
}
#heating-eve-preview h2,
#heating-eve-preview h3 {
  margin: 0;
  font-weight: 500;
}
#heating-eve-preview h2 {
  font-size: 20px;
}
#heating-eve-preview h3 {
  font-size: 16px;
}
#heating-eve-preview button,
#heating-eve-preview input,
#heating-eve-preview select {
  font: inherit;
  color: inherit;
}
#heating-eve-preview button,
#heating-eve-preview summary {
  cursor: pointer;
  touch-action: manipulation;
}
#heating-eve-preview button:disabled {
  opacity: 0.4;
  cursor: default;
}
#heating-eve-preview ha-icon {
  --mdc-icon-size: 18px;
  width: 18px;
  height: 18px;
  display: inline-flex;
  flex: none;
}

/* Device header and live controls. */
#heating-eve-preview .device-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 0;
}
#heating-eve-preview .device-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ha-selected);
  color: var(--ha-accent);
  flex: none;
}
#heating-eve-preview .device-icon ha-icon {
  --mdc-icon-size: 23px;
  width: 23px;
  height: 23px;
}
#heating-eve-preview .device-name .device-title {
  overflow-wrap: anywhere;
}
#heating-eve-preview .device-name {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
}
#heating-eve-preview .device-name > span {
  color: var(--ha-secondary);
  font-size: 12px;
  display: block;
}
#heating-eve-preview .battery {
  display: flex;
  gap: 5px;
  align-items: center;
  color: var(--ha-secondary);
  font-size: 12px;
  white-space: nowrap;
}
#heating-eve-preview .battery ha-icon {
  --mdc-icon-size: 20px;
  width: 20px;
  height: 20px;
}
#heating-eve-preview .battery.low {
  color: var(--ha-danger);
}
#heating-eve-preview .ha-content {
  padding: 8px 16px;
}
#heating-eve-preview .control-panel {
  padding: 16px 0 0;
}
#heating-eve-preview .temperature-grid,
#heating-eve-preview .mode-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  column-gap: 14px;
  align-items: center;
}
#heating-eve-preview .room-temperature,
#heating-eve-preview .target-temperature {
  min-width: 0;
}
#heating-eve-preview .room-temperature > span:first-child,
#heating-eve-preview .setpoint-label {
  display: block;
  color: var(--ha-secondary);
  font-size: 12px;
  margin: 0 0 5px;
}
#heating-eve-preview .room-temperature > div {
  display: flex;
  gap: 4px;
  align-items: baseline;
  min-height: 44px;
}
#heating-eve-preview #current-temperature {
  font-size: 29px;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
}
#heating-eve-preview .temperature-unit {
  font-size: 16px;
  color: var(--ha-secondary);
}
#heating-eve-preview .target-temperature {
  border-left: 1px solid var(--ha-divider);
  padding-left: 14px;
  text-align: center;
}
#heating-eve-preview .setpoint-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  min-width: 0;
}
#heating-eve-preview .setpoint-button {
  width: 32px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 22px;
  background: transparent;
  display: grid;
  place-items: center;
  color: var(--ha-accent);
  flex: none;
}
#heating-eve-preview .setpoint-button:hover {
  background: var(--ha-selected);
}
#heating-eve-preview #target-temperature {
  font-size: 25px;
  min-width: 0;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
#heating-eve-preview .mode-row {
  margin: 4px 0;
}
#heating-eve-preview .heating-status {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--state-climate-heat-color, #ff9800);
  font-size: 12px;
  min-height: 40px;
}
#heating-eve-preview .heating-status ha-icon {
  --mdc-icon-size: 14px;
  width: 14px;
  height: 14px;
}
#heating-eve-preview .heating-status.is-idle {
  color: var(--ha-secondary);
}
#heating-eve-preview .mode-picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  padding-left: 14px;
  min-width: 0;
}
#heating-eve-preview .mode-picker button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--ha-secondary);
  min-height: 40px;
  font-size: 11px;
  padding: 6px 2px;
}
#heating-eve-preview .mode-picker ha-icon {
  display: none;
}
#heating-eve-preview .mode-picker button[aria-pressed="true"],
#heating-eve-preview .day-picker button[aria-pressed="true"] {
  background: var(--ha-selected);
  color: var(--ha-accent);
  font-weight: 500;
}
#heating-eve-preview .target-context,
#heating-eve-preview #next-event-detail {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
#heating-eve-preview .next-event {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  min-height: 36px;
  color: var(--ha-secondary);
  text-align: left;
}
#heating-eve-preview .next-event > ha-icon {
  display: none;
}
#heating-eve-preview summary > ha-icon {
  color: var(--ha-secondary);
}
#heating-eve-preview .next-event > div {
  flex: 1;
  min-width: 0;
}
#heating-eve-preview #next-event-label {
  display: block;
  font-size: 12px;
}
#heating-eve-preview #resume-schedule {
  font-size: 12px;
  min-height: 40px;
  padding: 4px;
}

/* Shared actions and collapsible sections. */
#heating-eve-preview .icon-button {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ha-secondary);
  flex: none;
}
#heating-eve-preview .icon-button:hover {
  background: var(--ha-input);
}
#heating-eve-preview .text-button {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  background: transparent;
  border: 0;
  color: var(--ha-accent);
  font-weight: 500;
}
#heating-eve-preview .primary-button {
  background: var(--ha-accent);
  color: var(--ha-accent-foreground);
  font-weight: 500;
  border: 0;
  border-radius: 22px;
  padding: 11px 20px;
  min-height: 44px;
}
#heating-eve-preview .device-section {
  border-top: 1px solid var(--ha-divider);
  margin: 0 4px;
}
#heating-eve-preview .device-section > summary {
  list-style: none;
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 56px;
  user-select: none;
}
#heating-eve-preview summary::-webkit-details-marker {
  display: none;
}
#heating-eve-preview .device-section > summary > span {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
}
#heating-eve-preview .device-section small {
  display: block;
  color: var(--ha-secondary);
  font-size: 12px;
  font-weight: 400;
  margin-top: 3px;
}
#heating-eve-preview details[open] > summary .disclosure-icon {
  transform: rotate(180deg);
}

/* Schedule and editable temperature profiles. */
#heating-eve-preview .schedule-body {
  padding-bottom: 18px;
}
#heating-eve-preview .ha-panel {
  border: 1px solid var(--ha-divider);
  border-radius: 12px;
  background: var(--ha-background);
  padding: 0 12px;
  margin-bottom: 16px;
}
#heating-eve-preview .section-title {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
#heating-eve-preview .temperature-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  border-bottom: 1px solid var(--ha-divider);
}
#heating-eve-preview .temperature-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex: none;
  background: var(--preset-color);
}
#heating-eve-preview .temperature-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
#heating-eve-preview .temperature-value {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
#heating-eve-preview .day-picker {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px;
  margin: 0 -4px 16px;
}
#heating-eve-preview .day-picker button {
  min-height: 44px;
  min-width: 0;
  border: 0;
  border-radius: 22px;
  background: transparent;
  font-size: 13px;
}
#heating-eve-preview .day-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
#heating-eve-preview #day-title {
  font-weight: 500;
}
#heating-eve-preview #day-count {
  font-size: 12px;
  color: var(--ha-secondary);
  align-self: center;
}
#heating-eve-preview .timeline-axis {
  display: flex;
  justify-content: space-between;
  color: var(--ha-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  margin-bottom: 5px;
}
#heating-eve-preview .timeline {
  height: 20px;
  position: relative;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 18px;
}
#heating-eve-preview .timeline-segment {
  height: 100%;
  position: absolute;
  top: 0;
  background: var(--preset-color);
}
#heating-eve-preview .base-temperature {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
#heating-eve-preview .base-temperature > span {
  color: var(--ha-secondary);
  font-size: 13px;
}
#heating-eve-preview select {
  background: var(--ha-input);
  border: 0;
  border-bottom: 1px solid var(--ha-secondary);
  border-radius: 5px 5px 0 0;
  padding: 9px 24px 9px 10px;
  min-height: 44px;
  max-width: 100%;
  font-size: 16px;
}
#heating-eve-preview .base-temperature select {
  max-width: 54%;
}
#heating-eve-preview .period-list {
  border-top: 1px solid var(--ha-divider);
}
#heating-eve-preview .period {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  column-gap: 2px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ha-divider);
}
#heating-eve-preview .period-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 9px;
}
#heating-eve-preview .period-times {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  font-variant-numeric: tabular-nums;
}
#heating-eve-preview .period select {
  width: 100%;
  min-width: 0;
}
#heating-eve-preview .period-preset {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  width: 100%;
}
#heating-eve-preview .period-preset .temperature-dot {
  width: 8px;
  height: 8px;
}
#heating-eve-preview .period .icon-button {
  align-self: center;
}
#heating-eve-preview .schedule-time-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
#heating-eve-preview .schedule-time-input {
  width: 78px;
  min-width: 0;
  padding: 8px;
  background: var(--ha-input);
  border: 0;
  border-bottom: 1px solid var(--ha-secondary);
  border-radius: 4px 4px 0 0;
  min-height: 44px;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
#heating-eve-preview .schedule-time-input[aria-invalid="true"] {
  border-bottom-color: var(--ha-danger);
}
#heating-eve-preview .period .time-meridiem {
  width: 64px;
  min-width: 0;
  padding: 8px 2px;
  font-size: 13px;
  min-height: 44px;
}
#heating-eve-preview .save-row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  padding: 0 4px;
}
#heating-eve-preview #save-status {
  color: var(--ha-secondary);
  font-size: 12px;
  max-width: 53%;
}

/* Device settings. */
#heating-eve-preview .settings-body {
  padding-bottom: 12px;
}
#heating-eve-preview .setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 68px;
  border-top: 1px solid var(--ha-divider);
  font-size: 13px;
}
#heating-eve-preview .setting-row > span:first-child {
  flex: 1;
}
#heating-eve-preview .ha-switch {
  appearance: none;
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 14px;
  background: var(--ha-secondary);
  border: 0;
  margin: 9px 0;
  flex: none;
  cursor: pointer;
}
#heating-eve-preview .ha-switch::before {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: var(--ha-surface);
}
#heating-eve-preview .ha-switch:checked {
  background: var(--ha-accent);
}
#heating-eve-preview .ha-switch:checked::before {
  left: 21px;
}
#heating-eve-preview .numeric-setting {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--ha-secondary);
}
#heating-eve-preview .numeric-setting input {
  width: 60px;
  padding: 8px;
  border: 0;
  border-radius: 4px 4px 0 0;
  border-bottom: 1px solid var(--ha-secondary);
  background: var(--ha-input);
  min-height: 44px;
  font-size: 16px;
  text-align: center;
}

/* Dialogs and feedback. */
#heating-eve-preview .dialog-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: rgb(0 0 0 / 45%);
  padding: 100px 14px 20px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
#heating-eve-preview .ha-dialog {
  width: 100%;
  background: var(--ha-surface);
  border: 1px solid var(--ha-divider);
  border-radius: 18px;
  padding: 22px;
  box-shadow: var(--ha-card-box-shadow);
}
#heating-eve-preview .ha-dialog h3 {
  font-size: 20px;
  margin-bottom: 22px;
}
#heating-eve-preview .field-label {
  display: block;
  color: var(--ha-secondary);
  font-size: 12px;
  margin-bottom: 6px;
}
#heating-eve-preview .name-input {
  width: 100%;
  font-size: 16px;
  min-height: 48px;
  background: var(--ha-input);
  border: 0;
  border-bottom: 1px solid var(--ha-secondary);
  border-radius: 5px 5px 0 0;
  padding: 10px 12px;
  margin-bottom: 20px;
}
#heating-eve-preview .temperature-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin: 8px 0 24px;
}
#heating-eve-preview .temperature-stepper input {
  width: 100px;
  min-height: 48px;
  text-align: center;
  border: 0;
  border-bottom: 1px solid var(--ha-secondary);
  background: var(--ha-input);
  border-radius: 5px 5px 0 0;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}
#heating-eve-preview input[type="number"]::-webkit-inner-spin-button {
  appearance: none;
}
#heating-eve-preview .dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 18px;
}
#heating-eve-preview .dialog-actions .text-button {
  padding: 8px 12px;
}
#heating-eve-preview .delete-button {
  margin-right: auto;
  color: var(--ha-danger);
}
#heating-eve-preview .copy-choice {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}
#heating-eve-preview .copy-choice input {
  accent-color: var(--ha-accent);
  width: 18px;
  height: 18px;
}
#heating-eve-preview .copy-note {
  color: var(--ha-secondary);
  margin: 0 0 14px;
  font-size: 13px;
}
#heating-eve-preview .error-message {
  font-size: 13px;
  color: var(--ha-danger);
  padding-bottom: 14px;
}
#heating-eve-preview .device-feedback {
  padding: 0 20px 16px;
  color: var(--ha-secondary);
  font-size: 13px;
  overflow-wrap: anywhere;
}
#heating-eve-preview .device-feedback[data-error="true"] {
  color: var(--ha-danger);
}
@container (max-width: 350px) {
  #heating-eve-preview .device-header {
    padding: 14px 12px 0;
    gap: 8px;
  }
  #heating-eve-preview .device-name > span,
  #heating-eve-preview .battery {
    font-size: 11px;
  }
  #heating-eve-preview .ha-content {
    padding: 8px 12px;
  }
  #heating-eve-preview .temperature-grid,
  #heating-eve-preview .mode-row {
    column-gap: 8px;
  }
  #heating-eve-preview .target-temperature,
  #heating-eve-preview .mode-picker {
    padding-left: 8px;
  }
  #heating-eve-preview .setpoint-button {
    width: 26px;
  }
  #heating-eve-preview .setpoint-stepper {
    gap: 0;
  }
  #heating-eve-preview #target-temperature {
    font-size: 22px;
  }
}

/* Keep an interval's time, preset and remove action on one aligned row. */
#heating-eve-preview .period {
  grid-template-columns: minmax(0, 1fr) 32px;
  align-items: center;
}
#heating-eve-preview .period-main {
  grid-template-columns: minmax(112px, 0.9fr) minmax(0, 1fr);
  gap: 8px;
}
#heating-eve-preview .period-times {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 3px;
}
#heating-eve-preview .schedule-time-input {
  width: 100%;
  padding: 8px 2px;
  font-size: 14px;
}
#heating-eve-preview .period-preset {
  gap: 5px;
}
#heating-eve-preview .period-preset select {
  padding: 8px 16px 8px 5px;
  font-size: 14px;
}
#heating-eve-preview .period .icon-button {
  width: 32px;
}
#heating-eve-preview .schedule-time-field:has(.time-meridiem) {
  flex-wrap: wrap;
}

#heating-eve-preview .device-name .device-title {
  color: var(--ha-text);
  font-size: 16px;
  font-weight: 500;
}
#heating-eve-preview .device-name:hover .device-title {
  color: var(--ha-accent);
}
`;

  // src/locales/en.json
  var en_default = {
    control_title: "Living room radiator control",
    room_name: "Living room",
    device_name: "Radiator \xB7 SONOFF TRVZB",
    battery_label: "Battery 100 percent",
    temperature_and_mode: "Temperature and mode",
    room_temperature: "Room temperature",
    target_temperature: "Target temperature",
    target_down: "Decrease target temperature",
    target_up: "Increase target temperature",
    device_mode: "Radiator mode",
    mode_auto: "Auto",
    mode_manual: "Manual",
    mode_off: "Off",
    resume: "Resume",
    schedule: "Schedule",
    schedule_intro: "Custom temperatures and time slots",
    temperatures: "Temperatures",
    add_temperature: "Add temperature",
    copy_day: "Copy day",
    day_of_week: "Day of the week",
    daily_timeline: "Temperatures throughout the day",
    otherwise: "At other times",
    base_temperature: "Temperature outside time slots",
    add_period: "Add time slot",
    demo_changes: "Changes stay in this preview",
    save: "Save",
    settings: "Settings",
    settings_intro: "External sensor \xB7 frost protection",
    child_lock: "Child lock",
    child_lock_help: "Prevent accidental dial changes",
    open_window: "Open window detection",
    open_window_help: "Pause on a rapid temperature drop",
    temperature_source: "Temperature sensor",
    source_external: "External",
    source_internal: "Built-in",
    frost_protection: "Frost protection",
    frost_temperature: "Frost protection temperature",
    demo_time: "Preview \xB7 Wednesday, 20:30",
    not_connected: "Not connected to HA",
    unsaved: "Unsaved changes",
    heating: "Heating",
    off: "Off",
    target_reached: "Target reached",
    until_next: "Until the next time slot",
    manual_mode: "Manual mode",
    temporary_override: "Temporary override",
    constant_week: "One temperature all week",
    schedule_paused: "Schedule paused",
    resume_next: "Schedule resumes at the next time slot",
    resume_auto: "Switch to Auto to resume the schedule",
    external_sensor: "External sensor",
    internal_sensor: "Built-in sensor",
    dial_locked: "dial locked",
    invalid_period: "The start must be earlier than the end.",
    overlap: "Time slots overlap. Choose a different time.",
    edit_temperature: "Edit temperature",
    new_temperature: "New temperature",
    name: "Name",
    name_placeholder: "For example, Morning",
    temperature_celsius: "Temperature, \xB0C",
    temperature_down: "Decrease temperature",
    temperature_up: "Increase temperature",
    delete: "Delete",
    cancel: "Cancel",
    done: "Done",
    invalid_temperature: "Enter a name and a temperature from 4\u201335 \xB0C in 0.5\xB0 steps.",
    temperature_in_use: "This temperature is in use. Replace it in the time slots and \u201CAt other times\u201D first.",
    copy: "Copy",
    copied: "Day copied. Ready to save.",
    no_free_hour: "No free hour left. Shorten an existing time slot.",
    saved: "Preview saved \xB7 HA unchanged",
    preset_sleep: "Sleep",
    preset_home: "Home",
    preset_evening: "Evening",
    preview_language: "Preview language",
    edit_named: "Edit {name}",
    period_start: "Time slot {count} start",
    period_end: "Time slot {count} end",
    period_temperature: "Time slot {count} temperature",
    period_delete: "Delete time slot {count}",
    until_then: "Until {time} \xB7 then {temperature}",
    scheduled_preset: "Scheduled \xB7 {name}",
    frost_value: "Frost protection \xB7 {temperature}",
    next_period: "At {time} \xB7 {name}",
    next_temperature: "Next temperature \u2014 {temperature}",
    constant_temperature: "Always {temperature}",
    minimum_temperature: "Minimum temperature {temperature}",
    copy_note: "{day} \u2192 selected days. Their time slots will be replaced.",
    period_count: {
      one: "{count} time slot",
      other: "{count} time slots"
    },
    schedule_count: {
      one: "{count} temperature",
      other: "{count} temperatures"
    },
    day_0: "Monday",
    day_short_0: "Mon",
    day_1: "Tuesday",
    day_short_1: "Tue",
    day_2: "Wednesday",
    day_short_2: "Wed",
    day_3: "Thursday",
    day_short_3: "Thu",
    day_4: "Friday",
    day_short_4: "Fri",
    day_5: "Saturday",
    day_short_5: "Sat",
    day_6: "Sunday",
    day_short_6: "Sun",
    stored_on_valve: "Stored on the radiator valve",
    unavailable: "Unavailable",
    idle: "Idle",
    status_unknown: "Heating state unknown",
    battery_value: "Battery {value}%",
    connection_required: "Check the connection to the radiator",
    schedule_unavailable: "Schedule data is unavailable. No default schedule will be sent.",
    invalid_device_schedule: "The valve reported an invalid schedule.",
    admin_required: "An administrator is required to save temperature names.",
    sending: "Sending command\u2026",
    confirmation_timeout: "The valve did not confirm the update. Check its actual state before retrying.",
    command_failed: "Could not update the radiator: {error}",
    metadata_config_required: "Set dashboard and card_id to store temperature names.",
    metadata_card_missing: "The card could not be uniquely identified in its dashboard.",
    schedule_conflict: "The valve schedule changed while you were editing. Reload this page before saving.",
    saving: "Saving schedule and waiting for the valve\u2026",
    saved_device: "Schedule and temperature names saved.",
    save_partial: "Some days may have been saved. Reload the page and check the valve: {error}",
    save_failed: "Schedule not saved: {error}",
    too_many_transitions: "The valve supports at most six temperature changes per day, including midnight.",
    invalid_time_24: "Enter a 24-hour time, e.g. 18:30 (24:00 is valid for an end time).",
    invalid_time_12: "Enter a time from 01:00 to 12:59 and choose AM or PM.",
    period_meridiem: "{name}: AM or PM",
    open_history: "Open details and history for {name}",
    override_duration_unavailable: "A temporary adjustment requires a schedule change within the next 24 hours.",
    timer_entities_required: "Native timer entities are required to adjust the temperature in Auto mode.",
    room_temperature_short: "Room",
    target_temperature_short: "Target"
  };

  // src/locales/ru.json
  var ru_default = {
    control_title: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u0440\u043C\u043E\u0433\u043E\u043B\u043E\u0432\u043A\u043E\u0439 \u0433\u043E\u0441\u0442\u0438\u043D\u043E\u0439",
    room_name: "\u0413\u043E\u0441\u0442\u0438\u043D\u0430\u044F",
    device_name: "\u0420\u0430\u0434\u0438\u0430\u0442\u043E\u0440 \xB7 SONOFF TRVZB",
    battery_label: "\u0411\u0430\u0442\u0430\u0440\u0435\u044F 100 \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u043E\u0432",
    temperature_and_mode: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0438 \u0440\u0435\u0436\u0438\u043C",
    room_temperature: "\u0412 \u043A\u043E\u043C\u043D\u0430\u0442\u0435",
    target_temperature: "\u0417\u0430\u0434\u0430\u043D\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
    target_down: "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u043D\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443",
    target_up: "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u043D\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443",
    device_mode: "\u0420\u0435\u0436\u0438\u043C \u0433\u043E\u043B\u043E\u0432\u043A\u0438",
    mode_auto: "\u0410\u0432\u0442\u043E",
    mode_manual: "\u0412\u0440\u0443\u0447\u043D\u0443\u044E",
    mode_off: "\u0412\u044B\u043A\u043B.",
    resume: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C",
    schedule: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435",
    schedule_intro: "\u0421\u0432\u043E\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0438 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u044B",
    temperatures: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B",
    add_temperature: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443",
    copy_day: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u0435\u043D\u044C",
    day_of_week: "\u0414\u0435\u043D\u044C \u043D\u0435\u0434\u0435\u043B\u0438",
    daily_timeline: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0441\u0443\u0442\u043E\u043A",
    otherwise: "\u0412 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F",
    base_temperature: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u043D\u0435 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u043E\u0432",
    add_period: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
    demo_changes: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043F\u0440\u0438\u043C\u0435\u0440\u0435",
    save: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
    settings: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
    settings_intro: "\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \xB7 \u0437\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0437\u0430\u043C\u0435\u0440\u0437\u0430\u043D\u0438\u044F",
    child_lock: "\u0411\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0430 \u043A\u0440\u0443\u0442\u0438\u043B\u043A\u0438",
    child_lock_help: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0433\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F",
    open_window: "\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0438\u0435 \u043E\u043A\u043D\u0430",
    open_window_help: "\u041F\u0430\u0443\u0437\u0430 \u043F\u0440\u0438 \u0440\u0435\u0437\u043A\u043E\u043C \u043F\u0430\u0434\u0435\u043D\u0438\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B",
    temperature_source: "\u0414\u0430\u0442\u0447\u0438\u043A \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B",
    source_external: "\u0412\u043D\u0435\u0448\u043D\u0438\u0439",
    source_internal: "\u0412 \u0433\u043E\u043B\u043E\u0432\u043A\u0435",
    frost_protection: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0437\u0430\u043C\u0435\u0440\u0437\u0430\u043D\u0438\u044F",
    frost_temperature: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0437\u0430\u0449\u0438\u0442\u044B \u043E\u0442 \u0437\u0430\u043C\u0435\u0440\u0437\u0430\u043D\u0438\u044F",
    demo_time: "\u041F\u0440\u0438\u043C\u0435\u0440 \xB7 \u0441\u0440\u0435\u0434\u0430, 20:30",
    not_connected: "\u041D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043A HA",
    unsaved: "\u0415\u0441\u0442\u044C \u043D\u0435\u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F",
    heating: "\u0413\u0440\u0435\u0435\u0442",
    off: "\u0412\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
    target_reached: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430",
    until_next: "\u0414\u043E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430",
    manual_mode: "\u0420\u0443\u0447\u043D\u043E\u0439 \u0440\u0435\u0436\u0438\u043C",
    temporary_override: "\u0412\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043F\u043E\u043F\u0440\u0430\u0432\u043A\u0430",
    constant_week: "\u041E\u0434\u0438\u043D \u0440\u0435\u0436\u0438\u043C \u043D\u0430 \u0432\u0441\u044E \u043D\u0435\u0434\u0435\u043B\u044E",
    schedule_paused: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E",
    resume_next: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0432\u0435\u0440\u043D\u0451\u0442\u0441\u044F \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043F\u0435\u0440\u0438\u043E\u0434",
    resume_auto: "\u0412\u0435\u0440\u043D\u0451\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0432 \u0410\u0432\u0442\u043E",
    external_sensor: "\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A",
    internal_sensor: "\u0414\u0430\u0442\u0447\u0438\u043A \u0432 \u0433\u043E\u043B\u043E\u0432\u043A\u0435",
    dial_locked: "\u043A\u0440\u0443\u0442\u0438\u043B\u043A\u0430 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0430",
    invalid_period: "\u041D\u0430\u0447\u0430\u043B\u043E \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0440\u0430\u043D\u044C\u0448\u0435 \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F.",
    overlap: "\u0418\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u044B \u043F\u0435\u0440\u0435\u0441\u0435\u043A\u0430\u044E\u0442\u0441\u044F. \u0412\u044B\u0431\u0435\u0440\u0438 \u0434\u0440\u0443\u0433\u043E\u0435 \u0432\u0440\u0435\u043C\u044F.",
    edit_temperature: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443",
    new_temperature: "\u041D\u043E\u0432\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
    name: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
    name_placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0423\u0442\u0440\u043E",
    temperature_celsius: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \xB0C",
    temperature_down: "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443",
    temperature_up: "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443",
    delete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
    cancel: "\u041E\u0442\u043C\u0435\u043D\u0430",
    done: "\u0413\u043E\u0442\u043E\u0432\u043E",
    invalid_temperature: "\u0423\u043A\u0430\u0436\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 4\u201335 \xB0C \u0441 \u0448\u0430\u0433\u043E\u043C 0,5\xB0.",
    temperature_in_use: "\u042D\u0442\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0432 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0438. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u043C\u0435\u043D\u0438 \u0435\u0451 \u0432 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430\u0445 \u0438 \u0432 \xAB\u043E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F\xBB.",
    copy: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
    copied: "\u0414\u0435\u043D\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D. \u041C\u043E\u0436\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
    no_free_hour: "\u041D\u0435\u0442 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u0447\u0430\u0441\u0430. \u0421\u043E\u043A\u0440\u0430\u0442\u0438 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B.",
    saved: "\u041F\u0440\u0438\u043C\u0435\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \xB7 HA \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D",
    preset_sleep: "\u0421\u043E\u043D",
    preset_home: "\u0414\u043E\u043C\u0430",
    preset_evening: "\u0412\u0435\u0447\u0435\u0440",
    preview_language: "\u042F\u0437\u044B\u043A \u043F\u0440\u0438\u043C\u0435\u0440\u0430",
    edit_named: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C {name}",
    period_start: "\u041D\u0430\u0447\u0430\u043B\u043E \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430 {count}",
    period_end: "\u041A\u043E\u043D\u0435\u0446 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430 {count}",
    period_temperature: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430 {count}",
    period_delete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B {count}",
    until_then: "\u0414\u043E {time} \xB7 \u0437\u0430\u0442\u0435\u043C {temperature}",
    scheduled_preset: "\u041F\u043E \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044E \xB7 {name}",
    frost_value: "\u0417\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0437\u0430\u043C\u0435\u0440\u0437\u0430\u043D\u0438\u044F \xB7 {temperature}",
    next_period: "\u0412 {time} \xB7 {name}",
    next_temperature: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u2014 {temperature}",
    constant_temperature: "\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E {temperature}",
    minimum_temperature: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 {temperature}",
    copy_note: "{day} \u2192 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u0434\u043D\u0438. \u0418\u0445 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u044B \u0431\u0443\u0434\u0443\u0442 \u0437\u0430\u043C\u0435\u043D\u0435\u043D\u044B.",
    period_count: {
      one: "{count} \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B",
      few: "{count} \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430",
      many: "{count} \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u043E\u0432",
      other: "{count} \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430"
    },
    schedule_count: {
      one: "{count} \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
      few: "{count} \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B",
      many: "{count} \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440",
      other: "{count} \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B"
    },
    day_0: "\u041F\u043E\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0438\u043A",
    day_short_0: "\u041F\u043D",
    day_1: "\u0412\u0442\u043E\u0440\u043D\u0438\u043A",
    day_short_1: "\u0412\u0442",
    day_2: "\u0421\u0440\u0435\u0434\u0430",
    day_short_2: "\u0421\u0440",
    day_3: "\u0427\u0435\u0442\u0432\u0435\u0440\u0433",
    day_short_3: "\u0427\u0442",
    day_4: "\u041F\u044F\u0442\u043D\u0438\u0446\u0430",
    day_short_4: "\u041F\u0442",
    day_5: "\u0421\u0443\u0431\u0431\u043E\u0442\u0430",
    day_short_5: "\u0421\u0431",
    day_6: "\u0412\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u0435",
    day_short_6: "\u0412\u0441",
    stored_on_valve: "\u0425\u0440\u0430\u043D\u0438\u0442\u0441\u044F \u0432 \u0442\u0435\u0440\u043C\u043E\u0433\u043E\u043B\u043E\u0432\u043A\u0435",
    unavailable: "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438",
    idle: "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435",
    status_unknown: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043D\u0430\u0433\u0440\u0435\u0432\u0430 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E",
    battery_value: "\u0411\u0430\u0442\u0430\u0440\u0435\u044F {value}%",
    connection_required: "\u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0433\u043E\u043B\u043E\u0432\u043A\u0438",
    schedule_unavailable: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E. \u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E.",
    invalid_device_schedule: "\u0413\u043E\u043B\u043E\u0432\u043A\u0430 \u0441\u043E\u043E\u0431\u0449\u0438\u043B\u0430 \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435.",
    admin_required: "\u0414\u043B\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 \u043D\u0443\u0436\u0435\u043D \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440.",
    sending: "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u044B\u2026",
    confirmation_timeout: "\u0413\u043E\u043B\u043E\u0432\u043A\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0435\u0451 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u043C.",
    command_failed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0433\u043E\u043B\u043E\u0432\u043A\u0443: {error}",
    metadata_config_required: "\u0423\u043A\u0430\u0436\u0438 dashboard \u0438 card_id \u0434\u043B\u044F \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440.",
    metadata_card_missing: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u043D\u043E \u043D\u0430\u0439\u0442\u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043D\u0430 \u043F\u0430\u043D\u0435\u043B\u0438.",
    schedule_conflict: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0433\u043E\u043B\u043E\u0432\u043A\u0438 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F. \u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u043F\u0435\u0440\u0435\u0434 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435\u043C.",
    saving: "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u0438 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0433\u043E\u043B\u043E\u0432\u043A\u0438\u2026",
    saved_device: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.",
    save_partial: "\u0427\u0430\u0441\u0442\u044C \u0434\u043D\u0435\u0439 \u043C\u043E\u0433\u043B\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C\u0441\u044F. \u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0433\u043E\u043B\u043E\u0432\u043A\u0443: {error}",
    save_failed: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E: {error}",
    too_many_transitions: "\u0413\u043E\u043B\u043E\u0432\u043A\u0430 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 \u0448\u0435\u0441\u0442\u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439 \u0432 \u0441\u0443\u0442\u043A\u0438, \u0432\u043A\u043B\u044E\u0447\u0430\u044F \u043F\u043E\u043B\u043D\u043E\u0447\u044C.",
    invalid_time_24: "\u0412\u0432\u0435\u0434\u0438 \u0432\u0440\u0435\u043C\u044F \u0432 24-\u0447\u0430\u0441\u043E\u0432\u043E\u043C \u0444\u043E\u0440\u043C\u0430\u0442\u0435, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 18:30 (24:00 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E \u0434\u043B\u044F \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F).",
    invalid_time_12: "\u0412\u0432\u0435\u0434\u0438 \u0432\u0440\u0435\u043C\u044F \u043E\u0442 01:00 \u0434\u043E 12:59 \u0438 \u0432\u044B\u0431\u0435\u0440\u0438 AM \u0438\u043B\u0438 PM.",
    period_meridiem: "{name}: AM \u0438\u043B\u0438 PM",
    open_history: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044E: {name}",
    override_duration_unavailable: "\u0414\u043B\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u043F\u043E\u043F\u0440\u0430\u0432\u043A\u0438 \u043D\u0443\u0436\u0435\u043D \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u0432 \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0438\u0435 24 \u0447\u0430\u0441\u0430.",
    timer_entities_required: "\u0414\u043B\u044F \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 Auto \u043D\u0443\u0436\u043D\u044B \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u043E\u0433\u043E \u0442\u0430\u0439\u043C\u0435\u0440\u0430 \u0433\u043E\u043B\u043E\u0432\u043A\u0438.",
    room_temperature_short: "\u0412 \u043A\u043E\u043C\u043D\u0430\u0442\u0435",
    target_temperature_short: "\u0426\u0435\u043B\u044C"
  };

  // package.json
  var package_default = {
    name: "trvzb-control-card",
    version: "0.3.0",
    private: true,
    type: "module",
    description: "Unified SONOFF TRVZB Lovelace control with on-device schedules",
    scripts: {
      build: "python3 scripts/build-preview.py && node scripts/build-card.mjs",
      test: "node --test",
      "build:card": "node scripts/build-card.mjs",
      "test:browser": "node tests/browser/regressions.mjs",
      "check:dist": "node scripts/build-card.mjs --check",
      "check:release": "node scripts/check-release.mjs",
      "docs:screenshots": "node scripts/screenshots.mjs",
      "release:assets": "npm run check:dist && npm run check:release && node scripts/release-assets.mjs"
    },
    devDependencies: {
      "@mdi/js": "7.4.47",
      esbuild: "0.28.2",
      playwright: "1.64.1"
    },
    license: "MIT",
    engines: {
      node: ">=22"
    }
  };

  // src/ui/dom.js
  var escapeHTML = (value) => String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
  var clone = (value) => JSON.parse(JSON.stringify(value));

  // src/presets.js
  var nextId = 0;
  function createPresetId(existingIds = []) {
    const existing = new Set(existingIds);
    let id;
    do {
      nextId += 1;
      id = `custom-${Date.now().toString(36)}-${nextId.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    } while (existing.has(id));
    return id;
  }

  // src/time.js
  function uses12HourClock(locale = {}) {
    return String(locale.time_format) === "12";
  }
  function displayTime(value, use12Hours) {
    const [hour, minute] = value.split(":").map(Number);
    const normalizedHour = hour % 24;
    return {
      text: `${String(use12Hours ? normalizedHour % 12 || 12 : hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      meridiem: normalizedHour >= 12 ? "PM" : "AM"
    };
  }
  function parseTimeInput(text, { use12Hours = false, meridiem = "AM", isEnd = false } = {}) {
    let input = String(text).trim();
    if (/^\d{3,4}$/.test(input))
      input = `${input.slice(0, -2)}:${input.slice(-2)}`;
    const match = /^(\d{1,2}):(\d{2})$/.exec(input);
    if (!match)
      throw new Error(use12Hours ? "invalid_time_12" : "invalid_time_24");
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59)
      throw new Error(use12Hours ? "invalid_time_12" : "invalid_time_24");
    if (use12Hours) {
      if (hour < 1 || hour > 12 || !["AM", "PM"].includes(meridiem))
        throw new Error("invalid_time_12");
      hour = hour % 12 + (meridiem === "PM" ? 12 : 0);
    } else if (hour > 23 && !(isEnd && hour === 24 && minute === 0)) {
      throw new Error("invalid_time_24");
    }
    if (isEnd && hour === 0 && minute === 0) hour = 24;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  function formatClockTime(value, use12Hours) {
    const display = displayTime(value, use12Hours);
    return use12Hours ? `${display.text} ${display.meridiem}` : display.text;
  }

  // src/schedule.js
  var WEEKDAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
  ];
  var PRESET_COLORS = [
    "#529bcc",
    "#eea147",
    "#dd786e",
    "#8a83c9",
    "#61aa91",
    "#c1974c"
  ];
  var validTemperature = (value) => Number.isFinite(value) && value >= 4 && value <= 35 && value * 2 === Math.round(value * 2);
  function minuteOfDay(value, allowEnd = false) {
    if (allowEnd && value === "24:00") return 1440;
    if (!/^\d{2}:\d{2}$/.test(value)) throw new Error("invalid_period");
    const [hour, minute] = value.split(":").map(Number);
    if (hour > 23 || minute > 59) throw new Error("invalid_period");
    return hour * 60 + minute;
  }
  var timeOfDay = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  function parseSchedule(value) {
    if (typeof value !== "string" || !value.trim())
      throw new Error("schedule_unavailable");
    const points = /* @__PURE__ */ new Map();
    for (const token of value.trim().split(/\s+/)) {
      const [time, temperature, extra] = token.split("/");
      const minute = minuteOfDay(time);
      const temp = Number(temperature);
      if (!temperature || extra !== void 0 || !validTemperature(temp))
        throw new Error("invalid_device_schedule");
      points.set(minute, temp);
    }
    const sorted = [...points].sort((a, b) => a[0] - b[0]);
    if (sorted[0]?.[0] !== 0 || sorted.length > 6)
      throw new Error("invalid_device_schedule");
    return sorted.filter(
      (point, index) => index === 0 || point[1] !== sorted[index - 1][1]
    );
  }
  var formatSchedule = (points) => points.map(([minute, temp]) => `${timeOfDay(minute)}/${temp}`).join(" ");
  var canonicalSchedule = (value) => formatSchedule(parseSchedule(value));
  function compileDay(day, presets) {
    const temperature = (id) => {
      const temp = presets.find((p) => p.id === id)?.temp;
      if (!validTemperature(temp)) throw new Error("invalid_temperature");
      return temp;
    };
    const base = temperature(day.base);
    const periods = day.periods.map((p) => ({
      start: minuteOfDay(p.start),
      end: minuteOfDay(p.end, true),
      temp: temperature(p.preset)
    })).sort((a, b) => a.start - b.start);
    const points = /* @__PURE__ */ new Map([[0, base]]);
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (p.start >= p.end) throw new Error("invalid_period");
      if (i && periods[i - 1].end > p.start) throw new Error("overlap");
      points.set(p.start, p.temp);
      if (p.end < 1440) points.set(p.end, base);
    }
    const sorted = [...points].sort((a, b) => a[0] - b[0]);
    const reduced = sorted.filter(
      (point, index) => index === 0 || point[1] !== sorted[index - 1][1]
    );
    if (reduced.length > 6) throw new Error("too_many_transitions");
    return formatSchedule(reduced);
  }
  function decodeWeek(raw, storedPresets = [], storedDays) {
    const presets = structuredClone(storedPresets);
    for (const p of presets) {
      if (!p.id || !validTemperature(p.temp))
        throw new Error("invalid_temperature");
      p.color = PRESET_COLORS[presets.indexOf(p) % PRESET_COLORS.length];
    }
    const presetFor = (temp) => {
      let preset = presets.find((p) => p.temp === temp);
      if (!preset) {
        preset = {
          id: `temp-${String(temp).replace(".", "-")}`,
          temp,
          color: PRESET_COLORS[presets.length % PRESET_COLORS.length]
        };
        presets.push(preset);
      }
      return preset.id;
    };
    const days = raw.map((value, index) => {
      const points = parseSchedule(value);
      const stored = storedDays?.[index];
      if (stored) {
        try {
          if (compileDay(stored, presets) === canonicalSchedule(value))
            return structuredClone(stored);
        } catch {
        }
      }
      const base = presetFor(points[0][1]);
      return {
        base,
        periods: points.flatMap(
          ([minute, temp], i) => temp === points[0][1] ? [] : [
            {
              start: timeOfDay(minute),
              end: timeOfDay(points[i + 1]?.[0] ?? 1440),
              preset: presetFor(temp)
            }
          ]
        )
      };
    });
    return { presets, days };
  }
  function zonedClock(date, timeZone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        second: "2-digit"
      }).formatToParts(date).map((p) => [p.type, p.value])
    );
    return {
      day: WEEKDAYS.indexOf(parts.weekday.toLowerCase()),
      minute: Number(parts.hour) * 60 + Number(parts.minute),
      second: Number(parts.second)
    };
  }
  function scheduleNow(raw, clock) {
    const parsed = raw.map(parseSchedule);
    const valueAt = (day, minute) => parsed[day].findLast((p) => p[0] <= minute)?.[1];
    const active = valueAt(clock.day, clock.minute);
    for (let offset = 0; offset < 8; offset++) {
      const day = (clock.day + offset) % 7;
      for (const [minute, temp] of parsed[day]) {
        if (offset === 0 && minute <= clock.minute) continue;
        if (temp !== active)
          return { active, next: { day, offset, minute, temp } };
      }
    }
    return { active, next: null };
  }

  // src/ui/renderers.js
  function renderTemperatureRows(presets, view) {
    return presets.map(
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
  `
    ).join("");
  }
  function renderDayPicker(selectedDay, dayName) {
    return WEEKDAYS.map(
      (_, index) => `
    <button type="button" data-day="${index}" aria-pressed="${index === selectedDay}"
      aria-label="${dayName(index)}">${dayName(index, true)}</button>
  `
    ).join("");
  }
  function renderTimeline(day, presets, name) {
    return day.periods.map((period) => {
      const start = minuteOfDay(period.start);
      const end = minuteOfDay(period.end, true);
      const preset = presets.find((item) => item.id === period.preset);
      return `
      <div class="timeline-segment"
        style="left:${start / 14.4}%;width:${Math.max(0, end - start) / 14.4}%;--preset-color:${preset.color}"
        aria-label="${escapeHTML(`${period.start}\u2013${period.end}, ${name(preset)}`)}"></div>
    `;
    }).join("");
  }
  function renderTimeField(period, index, field, view) {
    const display = displayTime(period[field], view.use12Hours);
    const draft = view.timeDraft(index, field);
    const text = draft?.text ?? display.text;
    const meridiem = draft?.meridiem ?? display.meridiem;
    const label = view.t(field === "start" ? "period_start" : "period_end", {
      count: index + 1
    });
    return `
    <span class="schedule-time-field" data-time-field="${field}">
      <input class="schedule-time-input" type="text" inputmode="numeric" maxlength="5"
        value="${escapeHTML(text)}" data-field="${field}"
        placeholder="${view.use12Hours ? "hh:mm" : "HH:mm"}"
        aria-label="${escapeHTML(label)}" aria-invalid="${!!draft?.error}" autocomplete="off">
      ${view.use12Hours ? `
        <select class="time-meridiem" aria-label="${escapeHTML(view.t("period_meridiem", { name: label }))}">
          <option value="AM" ${meridiem === "AM" ? "selected" : ""}>AM</option>
          <option value="PM" ${meridiem === "PM" ? "selected" : ""}>PM</option>
        </select>
      ` : ""}
    </span>
  `;
  }
  function renderPeriodRows(day, presets, view) {
    return day.periods.map((period, index) => {
      const preset = presets.find((item) => item.id === period.preset);
      return `
      <div class="period" data-period="${index}">
        <div class="period-main">
          <div class="period-times">
            ${renderTimeField(period, index, "start", view)}
            <span aria-hidden="true">\u2014</span>
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
    }).join("");
  }
  function renderPresetDialog(preset, canDelete, view) {
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
  function renderCopyDialog(selectedDay, dayName, t) {
    return `
    <section class="ha-dialog" role="dialog" aria-modal="true" aria-labelledby="copy-title">
      <h3 id="copy-title">${t("copy_day")}</h3>
      <p class="copy-note">${t("copy_note", { day: dayName(selectedDay) })}</p>
      ${WEEKDAYS.map(
      (_, index) => index === selectedDay ? "" : `
        <label class="copy-choice">
          <input type="checkbox" value="${index}" ${selectedDay < 5 && index < 5 ? "checked" : ""}>
          <span>${dayName(index)}</span>
        </label>
      `
    ).join("")}
      <div class="dialog-actions">
        <button type="button" class="text-button" data-close>${t("cancel")}</button>
        <button type="button" class="primary-button" id="confirm-copy">${t("copy")}</button>
      </div>
    </section>
  `;
  }

  // src/localize.js
  function resolveLanguage(hass, fallback = "en") {
    return hass?.locale?.language || hass?.language || fallback;
  }
  function createLocalizer(catalogs2, requestedLanguage = "en") {
    const normalized = String(requestedLanguage).trim().toLowerCase().replaceAll("_", "-");
    const primary = normalized.split("-")[0];
    const language = Object.hasOwn(catalogs2, primary) ? primary : "en";
    const pluralRules = new Intl.PluralRules(language);
    const englishPluralRules = new Intl.PluralRules("en");
    return {
      language,
      t(key, values = {}) {
        let message = catalogs2[language]?.[key];
        let rules = pluralRules;
        if (message === void 0) {
          message = catalogs2.en?.[key];
          rules = englishPluralRules;
        }
        if (message && typeof message === "object") {
          message = message[rules.select(Number(values.count))] ?? message.other;
        }
        if (typeof message !== "string") return key;
        return message.replace(
          /\{(\w+)\}/g,
          (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match
        );
      },
      number(value, options = {}) {
        return new Intl.NumberFormat(language, {
          maximumFractionDigits: 1,
          useGrouping: false,
          ...options
        }).format(value);
      }
    };
  }

  // src/card.js
  var catalogs = { en: en_default, ru: ru_default };
  var CARD_VERSION = package_default.version;
  var TRVZBControlCard = class extends HTMLElement {
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
        (error) => this._feedback(
          this._t("command_failed", { error: error.message || String(error) }),
          true
        )
      );
      this._loaded = false;
      this._timeDrafts = /* @__PURE__ */ new Map();
    }
    setConfig(config) {
      if (!config.entity?.startsWith("climate."))
        throw new Error("A climate entity is required.");
      const expanded = this._root ? [...this._root.querySelectorAll("details[open]")].map((el) => el.id) : [];
      const base = config.entity.slice("climate.".length);
      if (this._selectedEntity !== config.entity) {
        this._hasSelectedDay = false;
        this._selectedEntity = config.entity;
      }
      this._config = clone(config);
      this._ids = {
        climate: config.entity,
        timerTarget: config.timer_target_entity || `number.${base}_timer_mode_target_temperature`,
        timerDuration: config.timer_duration_entity || `number.${base}_temporary_mode_duration`,
        timerMode: config.timer_mode_entity || `select.${base}_temporary_mode`,
        battery: config.battery_entity || `sensor.${base}_battery`,
        source: config.source_entity || `select.${base}_temperature_sensor`,
        lock: config.lock_entity || `switch.${base}_child_lock`,
        window: config.window_entity || `switch.${base}_open_window`,
        frost: config.frost_entity || `number.${base}_frost_protection_temperature`
      };
      this._scheduleIds = config.schedule_entities || WEEKDAYS.map((day) => `text.${base}_weekly_schedule_${day}`);
      if (this._scheduleIds.length !== 7)
        throw new Error(
          "Exactly seven schedule entities are required (Monday to Sunday)."
        );
      this.shadowRoot.innerHTML = `<style>${card_default2}</style><ha-card>${card_default}</ha-card>`;
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
      }, 3e4);
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
      return Number.isFinite(value) ? `${this._localizer.number(value)} \xB0C` : "\u2014";
    }
    _name(preset) {
      return preset?.nameKey ? this._t(preset.nameKey) : preset?.name || this._fmt(preset?.temp);
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
        /* @__PURE__ */ new Date(),
        this._hass.config?.time_zone || "Europe/Prague"
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
          (id) => this._hass.states[id]
        )
      ]);
      if (signature === this._signature) return;
      this._signature = signature;
      this._localizer = createLocalizer(catalogs, language);
      const raw = this._raw();
      const rawSignature = JSON.stringify(raw);
      const use12Hours = uses12HourClock(this._hass.locale);
      let redrawEditor = this._language !== this._localizer.language || this._use12Hours !== use12Hours;
      if (this._use12Hours !== void 0 && this._use12Hours !== use12Hours) {
        for (const [key, draft] of this._timeDrafts) {
          const [day, index, field] = key.split("/");
          const canonical = this._week?.days[Number(day)]?.periods[Number(index)]?.[field];
          if (canonical && !draft.error) {
            this._timeDrafts.set(key, {
              ...displayTime(canonical, use12Hours),
              error: null
            });
          } else if (draft.error) {
            draft.error = use12Hours ? "invalid_time_12" : "invalid_time_24";
          }
        }
      }
      this._use12Hours = use12Hours;
      this._language = this._localizer.language;
      if (!this._dirty && !this._busy && (!this._loaded || rawSignature !== this._rawSignature)) {
        try {
          this._week = decodeWeek(
            raw,
            this._config.temperatures || [],
            this._config.day_profiles
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
      this._root.querySelectorAll("[data-i18n]").forEach((el) => el.textContent = this._t(el.dataset.i18n));
      this._root.querySelectorAll("[data-i18n-aria-label]").forEach(
        (el) => el.setAttribute("aria-label", this._t(el.dataset.i18nAriaLabel))
      );
      const name = this._config.name || this._entity("climate")?.attributes.friendly_name || this._config.entity;
      this._$(".device-title").textContent = name;
      this._$(".device-name").setAttribute(
        "aria-label",
        this._t("open_history", { name })
      );
      this._$(".ha-demo").setAttribute("aria-label", name);
      this._$("#save-status").textContent = this._t(
        this._dirty ? "unsaved" : "stored_on_valve"
      );
    }
    _renderControl() {
      if (!this._localizer) return;
      const climate = this._entity("climate");
      const available = this._available(climate) && this._hass.connected !== false;
      const attributes = climate?.attributes || {};
      const target = this._targetQueue.pending ?? this._reportedTarget();
      const mode = climate?.state;
      const current = attributes.current_temperature;
      this._$("#current-temperature").textContent = Number.isFinite(current) ? this._localizer.number(current, { minimumFractionDigits: 1 }) : "\u2014";
      this._$("#target-temperature").textContent = mode === "off" ? "\u2014" : this._fmt(target);
      this._$("#target-down").disabled = !available || this._busy || mode === "off" || target === null || target <= (attributes.min_temp ?? 4);
      this._$("#target-up").disabled = !available || this._busy || mode === "off" || target === null || target >= (attributes.max_temp ?? 35);
      const status = !available ? "unavailable" : mode === "off" ? "off" : attributes.hvac_action === "heating" ? "heating" : attributes.hvac_action === "idle" ? "idle" : "status_unknown";
      this._$("#heating-status").innerHTML = `<ha-icon icon="mdi:${status === "heating" ? "fire" : mode === "off" ? "power" : "thermometer"}" aria-hidden="true"></ha-icon>${this._t(status)}`;
      this._$("#heating-status").classList.toggle(
        "is-idle",
        status !== "heating"
      );
      this._root.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
        button.disabled = !available || this._busy || this._targetQueue.pending !== null || !attributes.hvac_modes?.includes(button.dataset.mode);
      });
      const battery = this._entity("battery");
      const batteryValue = this._available(battery) ? Number(battery.state) : NaN;
      this._$(".battery").innerHTML = `<ha-icon icon="mdi:${batteryValue <= 20 ? "battery-low" : "battery"}" aria-hidden="true"></ha-icon>${Number.isFinite(batteryValue) ? this._localizer.number(batteryValue) + "%" : "\u2014"}`;
      this._$(".battery").classList.toggle("low", batteryValue <= 20);
      this._$(".battery").setAttribute(
        "aria-label",
        this._t("battery_value", {
          value: Number.isFinite(batteryValue) ? this._localizer.number(batteryValue) : "\u2014"
        })
      );
      let plan;
      try {
        plan = scheduleNow(this._raw(), this._clock());
      } catch {
      }
      const preset = (temp) => this._week?.presets.find((p) => p.temp === temp) || { temp };
      const next = plan?.next;
      const nextTime = next ? `${next.offset ? this._dayName(next.day, true) + ", " : ""}${formatClockTime(timeOfDay(next.minute), this._use12Hours)}` : "";
      const override = mode === "auto" && target !== null && plan && Math.abs(target - plan.active) > 0.01;
      this._$("#target-context").textContent = !available ? this._t("unavailable") : mode === "auto" ? override ? next ? this._t("until_then", {
        time: nextTime,
        temperature: this._fmt(next.temp)
      }) : this._t("until_next") : plan ? this._t("scheduled_preset", {
        name: this._name(preset(plan.active))
      }) : this._t("schedule_unavailable") : mode === "heat" ? this._t("manual_mode") : this._t("frost_value", {
        temperature: this._fmt(Number(this._entity("frost")?.state))
      });
      this._$("#next-event-label").textContent = !available ? this._t("unavailable") : mode === "auto" ? override ? this._$("#target-context").textContent : next ? `${this._t("next_period", {
        time: nextTime,
        name: this._name(preset(next.temp))
      })} \xB7 ${this._fmt(next.temp)}` : this._t("constant_week") : mode === "heat" ? this._t("schedule_paused") : `${this._t("frost_protection")} \xB7 ${this._fmt(Number(this._entity("frost")?.state))}`;
      this._$("#next-event-detail").textContent = !available ? this._t("connection_required") : mode === "auto" ? override ? this._t("resume_next") : next ? this._t("next_temperature", { temperature: this._fmt(next.temp) }) : plan ? this._t("constant_temperature", {
        temperature: this._fmt(plan.active)
      }) : this._t("schedule_unavailable") : mode === "heat" ? this._t("resume_auto") : this._t("minimum_temperature", {
        temperature: this._fmt(Number(this._entity("frost")?.state))
      });
      this._$("#resume-schedule").hidden = !available || !override && mode !== "heat";
      this._$("#resume-schedule").disabled = !available || this._busy || this._targetQueue.pending !== null;
      this._renderSettings();
      if (this._week)
        this._$("#schedule-summary").textContent = this._t("schedule_count", {
          count: this._week.presets.length
        });
      this._$("#save-schedule").disabled = !this._canSave();
    }
    _renderSettings() {
      for (const [id, key] of [
        ["child-lock", "lock"],
        ["open-window", "window"]
      ]) {
        const entity = this._entity(key);
        this._$("#" + id).checked = entity?.state === "on";
        this._$("#" + id).disabled = this._busy || !this._available(entity) || this._hass.connected === false;
      }
      const source = this._entity("source");
      const select = this._$("#temperature-source");
      const options = source?.attributes.options || [];
      select.innerHTML = options.map(
        (value) => `<option value="${escapeHTML(value)}">${escapeHTML(value === "internal" ? this._t("source_internal") : value === "external" ? this._t("source_external") : value)}</option>`
      ).join("");
      select.value = source?.state;
      select.disabled = this._busy || !this._available(source) || this._hass.connected === false;
      const frost = this._entity("frost");
      const input = this._$("#frost-temperature");
      if (this.shadowRoot.activeElement !== input)
        input.value = this._available(frost) ? frost.state : "";
      input.min = frost?.attributes.min ?? 4;
      input.max = frost?.attributes.max ?? 35;
      input.step = frost?.attributes.step ?? 0.5;
      input.disabled = this._busy || !this._available(frost) || this._hass.connected === false;
      this._$("#settings-summary").textContent = `${source?.state === "internal" ? this._t("internal_sensor") : this._t("external_sensor")}${this._entity("lock")?.state === "on" ? " \xB7 " + this._t("dial_locked") : ""}`;
    }
    _options(id) {
      return this._week.presets.map(
        (p) => `<option value="${escapeHTML(p.id)}" ${p.id === id ? "selected" : ""}>${escapeHTML(this._name(p))} \xB7 ${this._fmt(p.temp)}</option>`
      ).join("");
    }
    _renderEditor() {
      this._editorRendered = true;
      this._root.querySelectorAll(
        "#add-temperature,#add-period,#copy-day,#base-temperature"
      ).forEach((el) => el.disabled = !this._loaded || this._busy);
      if (!this._loaded) {
        this._editorError(this._t(this._scheduleError || "schedule_unavailable"));
        return;
      }
      const week = this._week, day = week.days[this._day];
      const preset = (id) => week.presets.find((p) => p.id === id);
      this._$("#temperature-list").innerHTML = renderTemperatureRows(
        week.presets,
        this._view()
      );
      this._$("#day-picker").innerHTML = renderDayPicker(
        this._day,
        this._dayName.bind(this)
      );
      this._$("#day-title").textContent = this._dayName(this._day);
      this._$("#day-count").textContent = this._t("period_count", {
        count: day.periods.length
      });
      this._$("#base-temperature").innerHTML = this._options(day.base);
      this._$("#timeline").style.background = preset(day.base).color;
      this._$("#timeline").innerHTML = renderTimeline(
        day,
        week.presets,
        this._name.bind(this)
      );
      this._$("#period-list").innerHTML = renderPeriodRows(
        day,
        week.presets,
        this._view()
      );
      this._root.querySelectorAll(
        ".schedule-body button,.schedule-body input,.schedule-body select"
      ).forEach((el) => el.disabled = this._busy);
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
        timeDraft: (index, field) => this._timeDrafts.get(this._timeKey(index, field))
      };
    }
    _timeKey(index, field) {
      return `${this._day}/${index}/${field}`;
    }
    _canSave() {
      return this._dirty && this._loaded && !this._busy && this._targetQueue.pending === null && !this._validationMessage && this._hass.user?.is_admin;
    }
    _validateDraft() {
      const invalidTime = [...this._timeDrafts.values()].find(
        (draft) => draft.error
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
          this._name.bind(this)
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
          isEnd: field === "end"
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
      this._changed(false);
    }
    _removePeriod(index) {
      this._week.days[this._day].periods.splice(index, 1);
      const drafts = /* @__PURE__ */ new Map();
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
      return this._entity("climate")?.state === "auto" && this._entity("timerMode")?.state === "timer" && Number(this._entity("timerDuration")?.state) > 0;
    }
    _reportedTarget() {
      const value = this._entity("climate")?.attributes.temperature;
      return Number.isFinite(value) ? value : null;
    }
    async _sendTarget(value) {
      const mode = this._entity("climate")?.state;
      if (!this._available(this._entity("climate")) || this._hass.connected === false || mode === "off")
        throw new Error(this._t("connection_required"));
      if (mode === "auto") {
        const clock = this._clock();
        const next = scheduleNow(this._raw(), clock).next;
        const minutes = next ? Math.ceil(
          next.offset * 1440 + next.minute - clock.minute - (clock.second || 0) / 60
        ) : 0;
        if (minutes < 1 || minutes > 1440)
          throw new Error(this._t("override_duration_unavailable"));
        if (!this._entity("timerTarget") || !this._available(this._entity("timerDuration")) || !this._available(this._entity("timerMode")))
          throw new Error(this._t("timer_entities_required"));
        await this._hass.callService("number", "set_value", {
          entity_id: this._ids.timerTarget,
          value
        });
        await this._hass.callService("number", "set_value", {
          entity_id: this._ids.timerDuration,
          value: minutes
        });
        await this._hass.callService("select", "select_option", {
          entity_id: this._ids.timerMode,
          option: "timer"
        });
        await this._waitFor(
          () => this._timerConfigured() && Number(this._entity("timerDuration")?.state) === minutes && Math.abs(this._entity("climate")?.attributes.temperature - value) < 0.01
        );
      } else {
        await this._hass.callService("climate", "set_temperature", {
          entity_id: this._ids.climate,
          temperature: value
        });
        await this._waitFor(
          () => Math.abs(this._entity("climate")?.attributes.temperature - value) < 0.01
        );
      }
    }
    async _waitFor(predicate, timeout = 15e3) {
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
        if (domain === "climate" && service === "set_hvac_mode" && this._timerConfigured()) {
          await this._hass.callService("number", "set_value", {
            entity_id: this._ids.timerDuration,
            value: 0
          });
          await this._waitFor(
            () => Number(this._entity("timerDuration")?.state) === 0
          );
        }
        await this._hass.callService(domain, service, data);
        if (predicate) await this._waitFor(predicate);
        this._feedback("");
      } catch (error) {
        this._feedback(
          this._t("command_failed", { error: error.message || String(error) }),
          true
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
        url_path: this._config.dashboard
      });
      let count = 0;
      const update = (node) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "custom:trvzb-control-card" && node.card_id === this._config.card_id) {
          node.temperatures = clone(this._week.presets);
          node.day_profiles = clone(this._week.days);
          count++;
          return;
        }
        Object.values(node).forEach(
          (value) => Array.isArray(value) ? value.forEach(update) : update(value)
        );
      };
      update(config);
      if (count !== 1) throw new Error(this._t("metadata_card_missing"));
      await this._hass.callWS({
        type: "lovelace/config/save",
        url_path: this._config.dashboard,
        config
      });
      this._config.temperatures = clone(this._week.presets);
      this._config.day_profiles = clone(this._week.days);
    }
    async _save() {
      if (this._busy || this._targetQueue.pending !== null || !this._dirty || !this._hass.user?.is_admin)
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
        if (this._raw().some(
          (raw, i) => canonicalSchedule(raw) !== this._baseline[i]
        ))
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
              value: desired[i]
            });
            writes++;
            await this._waitFor(() => {
              try {
                return canonicalSchedule(this._hass.states[id]?.state) === desired[i];
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
            error: error.message || String(error)
          }),
          true
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
      const preset = id ? this._week.presets.find((p) => p.id === id) : { name: "", temp: 20 };
      this._dialogTrigger = this.shadowRoot.activeElement;
      this._dialog = "preset";
      this._$("#dialog-layer").innerHTML = renderPresetDialog(
        preset,
        !!id && this._week.presets.length > 1,
        this._view()
      );
      this._$("#dialog-layer").hidden = false;
      this._$("#preset-name").focus();
      this._$("#confirm-preset").onclick = () => {
        const name = this._$("#preset-name").value.trim(), temp = Number(this._$("#preset-temp").value);
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
            color: PRESET_COLORS[this._week.presets.length % PRESET_COLORS.length]
          });
        this._closeDialog();
        this._changed();
      };
      if (this._$("#delete-preset"))
        this._$("#delete-preset").onclick = () => {
          if (this._week.days.some(
            (day) => day.base === id || day.periods.some((p) => p.preset === id)
          )) {
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
        this._t.bind(this)
      );
      this._$("#dialog-layer").hidden = false;
      this._$("#dialog-layer input")?.focus();
      this._$("#confirm-copy").onclick = () => {
        const selected = [
          ...this._root.querySelectorAll(".copy-choice input:checked")
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
            composed: true
          })
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
          () => this._entity("climate")?.state === mode
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
              current + (button.id === "target-up" ? 1 : -1) * (a.target_temp_step ?? 0.5)
            )
          )
        );
      } else if (button.id === "resume-schedule") {
        const scheduled = scheduleNow(this._raw(), this._clock()).active;
        this._command(
          "climate",
          "set_hvac_mode",
          { entity_id: this._ids.climate, hvac_mode: "auto" },
          () => this._entity("climate")?.state === "auto" && !this._timerConfigured() && Math.abs(this._reportedTarget() - scheduled) < 0.01
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
          Math.max(4, Number(input.value) + Number(button.dataset.step))
        );
      } else if (button.id === "copy-day") this._showCopy();
      else if (button.id === "save-schedule") this._save();
      else if (button.id === "add-period") {
        const periods = this._week.days[this._day].periods;
        let start = 0;
        for (const period of [...periods].sort(
          (a, b) => minuteOfDay(a.start) - minuteOfDay(b.start)
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
          preset: this._week.presets[1]?.id || this._week.presets[0].id
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
        const entity = this._ids[switches[el.id]], desired = el.checked ? "on" : "off";
        this._command(
          "switch",
          el.checked ? "turn_on" : "turn_off",
          { entity_id: entity },
          () => this._hass.states[entity]?.state === desired
        );
        return;
      }
      if (el.id === "temperature-source") {
        const value = el.value;
        this._command(
          "select",
          "select_option",
          { entity_id: this._ids.source, option: value },
          () => this._entity("source")?.state === value
        );
        return;
      }
      if (el.id === "frost-temperature") {
        const value = Number(el.value), a = this._entity("frost").attributes, step = a.step ?? 0.5;
        if (!Number.isFinite(value) || value < (a.min ?? 4) || value > (a.max ?? 35) || Math.abs(value / step - Math.round(value / step)) > 1e-3) {
          this._renderControl();
          return;
        }
        this._command(
          "number",
          "set_value",
          { entity_id: this._ids.frost, value },
          () => Number(this._entity("frost")?.state) === value
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
        this._week.days[this._day].periods[Number(row.dataset.period)].preset = el.value;
        this._changed();
      }
    }
    _keydown(event) {
      if (event.key === "Escape" && this._dialog) this._closeDialog();
      if (event.key === "Tab" && this._dialog) {
        const controls = [
          ...this._$("#dialog-layer").querySelectorAll("button,input,select")
        ].filter((el) => !el.disabled);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && this.shadowRoot.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && this.shadowRoot.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  };
  if (!customElements.get("trvzb-control-card"))
    customElements.define("trvzb-control-card", TRVZBControlCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "trvzb-control-card",
    name: "TRVZB Control",
    description: "Unified SONOFF TRVZB control with on-device schedules."
  });
  console.info(`TRVZB Control ${CARD_VERSION}`);
})();
//# sourceMappingURL=trvzb-control-card.js.map
