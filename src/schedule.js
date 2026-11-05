/** TRVZB schedule conversion; all errors are localization keys. */
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
export const PRESET_COLORS = [
  "#529bcc",
  "#eea147",
  "#dd786e",
  "#8a83c9",
  "#61aa91",
  "#c1974c",
];
export const validTemperature = (value) =>
  Number.isFinite(value) &&
  value >= 4 &&
  value <= 35 &&
  value * 2 === Math.round(value * 2);
export function minuteOfDay(value, allowEnd = false) {
  if (allowEnd && value === "24:00") return 1440;
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error("invalid_period");
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) throw new Error("invalid_period");
  return hour * 60 + minute;
}
export const timeOfDay = (value) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
export function parseSchedule(value) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("schedule_unavailable");
  const points = new Map();
  for (const token of value.trim().split(/\s+/)) {
    const [time, temperature, extra] = token.split("/");
    const minute = minuteOfDay(time);
    const temp = Number(temperature);
    if (!temperature || extra !== undefined || !validTemperature(temp))
      throw new Error("invalid_device_schedule");
    points.set(minute, temp);
  }
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (sorted[0]?.[0] !== 0 || sorted.length > 6)
    throw new Error("invalid_device_schedule");
  return sorted.filter(
    (point, index) => index === 0 || point[1] !== sorted[index - 1][1],
  );
}
export const formatSchedule = (points) =>
  points.map(([minute, temp]) => `${timeOfDay(minute)}/${temp}`).join(" ");
export const canonicalSchedule = (value) =>
  formatSchedule(parseSchedule(value));
export function compileDay(day, presets) {
  const temperature = (id) => {
    const temp = presets.find((p) => p.id === id)?.temp;
    if (!validTemperature(temp)) throw new Error("invalid_temperature");
    return temp;
  };
  const base = temperature(day.base);
  const periods = day.periods
    .map((p) => ({
      start: minuteOfDay(p.start),
      end: minuteOfDay(p.end, true),
      temp: temperature(p.preset),
    }))
    .sort((a, b) => a.start - b.start);
  const points = new Map([[0, base]]);
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (p.start >= p.end) throw new Error("invalid_period");
    if (i && periods[i - 1].end > p.start) throw new Error("overlap");
    points.set(p.start, p.temp);
    if (p.end < 1440) points.set(p.end, base);
  }
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const reduced = sorted.filter(
    (point, index) => index === 0 || point[1] !== sorted[index - 1][1],
  );
  if (reduced.length > 6) throw new Error("too_many_transitions");
  return formatSchedule(reduced);
}
export function decodeWeek(raw, storedPresets = [], storedDays) {
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
        color: PRESET_COLORS[presets.length % PRESET_COLORS.length],
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
        /* Rebuild stale editor metadata from the valve. */
      }
    }
    const base = presetFor(points[0][1]);
    return {
      base,
      periods: points.flatMap(([minute, temp], i) =>
        temp === points[0][1]
          ? []
          : [
              {
                start: timeOfDay(minute),
                end: timeOfDay(points[i + 1]?.[0] ?? 1440),
                preset: presetFor(temp),
              },
            ],
      ),
    };
  });
  return { presets, days };
}
export function zonedClock(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: WEEKDAYS.indexOf(parts.weekday.toLowerCase()),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    second: Number(parts.second),
  };
}
export function scheduleNow(raw, clock) {
  const parsed = raw.map(parseSchedule);
  const valueAt = (day, minute) =>
    parsed[day].findLast((p) => p[0] <= minute)?.[1];
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
