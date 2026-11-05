/** English UI copy does not imply a US clock. Only explicit 12-hour opt-in enables AM/PM. */
export function uses12HourClock(locale = {}) {
  return String(locale.time_format) === "12";
}

/** Canonical storage is always 00:00–23:59, plus 24:00 for an interval end. */
export function displayTime(value, use12Hours) {
  const [hour, minute] = value.split(":").map(Number);
  const normalizedHour = hour % 24;
  return {
    text: `${String(use12Hours ? normalizedHour % 12 || 12 : hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    meridiem: normalizedHour >= 12 ? "PM" : "AM",
  };
}

export function parseTimeInput(
  text,
  { use12Hours = false, meridiem = "AM", isEnd = false } = {},
) {
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
    hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
  } else if (hour > 23 && !(isEnd && hour === 24 && minute === 0)) {
    throw new Error("invalid_time_24");
  }
  if (isEnd && hour === 0 && minute === 0) hour = 24;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatClockTime(value, use12Hours) {
  const display = displayTime(value, use12Hours);
  return use12Hours ? `${display.text} ${display.meridiem}` : display.text;
}
