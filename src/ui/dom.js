export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

export const clone = (value) => JSON.parse(JSON.stringify(value));

export const ICONS = {
  heater: "radiator",
  thermometer: "thermometer",
  "battery-full": "battery",
  "calendar-clock": "calendar-clock",
  hand: "hand-back-right-outline",
  power: "power",
  "clock-3": "clock-outline",
  "calendar-days": "calendar-month-outline",
  "chevron-down": "chevron-down",
  "settings-2": "tune",
  copy: "content-copy",
  plus: "plus",
  minus: "minus",
  pencil: "pencil-outline",
  x: "close",
  flame: "fire",
  check: "check",
};
