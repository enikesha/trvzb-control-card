import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalSchedule,
  parseSchedule,
  compileDay,
  decodeWeek,
  scheduleNow,
  zonedClock,
} from "../src/schedule.js";
const weekday = "00:00/16 07:00/19 10:00/16 10:00/16 17:00/19 23:00/16";
const weekend = "00:00/16 07:00/19 10:00/19 10:00/19 10:00/19 23:00/16";
const raw = [weekday, weekday, weekday, weekday, weekday, weekend, weekend];

test("real TRVZB schedules round-trip without changing their meaning", () => {
  const week = decodeWeek(raw, [
    { id: "sleep", nameKey: "preset_sleep", temp: 16 },
    { id: "home", nameKey: "preset_home", temp: 19 },
  ]);
  assert.equal(week.days[0].periods.length, 2);
  assert.equal(week.days[5].periods.length, 1);
  assert.deepEqual(
    week.days.map((d) => compileDay(d, week.presets)),
    raw.map(canonicalSchedule),
  );
});
test("adjacent periods, midnight boundaries and neutral intervals compile correctly", () => {
  const presets = [
    { id: "base", temp: 16 },
    { id: "home", temp: 20 },
    { id: "hot", temp: 22 },
  ];
  assert.equal(
    compileDay(
      {
        base: "base",
        periods: [
          { start: "00:00", end: "08:00", preset: "home" },
          { start: "08:00", end: "24:00", preset: "hot" },
        ],
      },
      presets,
    ),
    "00:00/20 08:00/22",
  );
  assert.equal(
    compileDay(
      {
        base: "base",
        periods: [{ start: "01:00", end: "03:00", preset: "base" }],
      },
      presets,
    ),
    "00:00/16",
  );
});
test("rejects overlapping, invalid and device-incompatible schedules", () => {
  const presets = [
    { id: "base", temp: 16 },
    { id: "home", temp: 20 },
  ];
  assert.throws(
    () =>
      compileDay(
        {
          base: "base",
          periods: [
            { start: "07:00", end: "10:00", preset: "home" },
            { start: "09:00", end: "12:00", preset: "home" },
          ],
        },
        presets,
      ),
    /overlap/,
  );
  assert.throws(
    () =>
      compileDay(
        {
          base: "base",
          periods: [1, 4, 7].map((h) => ({
            start: `0${h}:00`,
            end: `0${h + 1}:00`,
            preset: "home",
          })),
        },
        presets,
      ),
    /too_many_transitions/,
  );
  assert.throws(() => parseSchedule("07:00/20"), /invalid_device_schedule/);
  assert.throws(() => parseSchedule("00:00/99"), /invalid_device_schedule/);
  assert.throws(() => parseSchedule("00:00/16 25:00/19"), /invalid_period/);
  assert.throws(
    () => decodeWeek(raw.map(() => "unavailable")),
    /invalid_period|schedule_unavailable/,
  );
});
test("retains named profiles only when they match the actual valve schedule", () => {
  const week = decodeWeek(raw);
  const metadata = structuredClone(week.days);
  metadata[0].periods[0].start = "06:00";
  const restored = decodeWeek(raw, week.presets, metadata);
  assert.equal(restored.days[0].periods[0].start, "07:00");
  assert.deepEqual(restored.days[1], metadata[1]);
});
test("uses HA timezone and finds next changes across week boundaries", () => {
  assert.deepEqual(
    zonedClock(new Date("2026-11-04T22:30:00Z"), "Europe/Prague"),
    { day: 2, minute: 1410, second: 0 },
  );
  assert.deepEqual(scheduleNow(raw, { day: 2, minute: 20 * 60 + 30 }), {
    active: 19,
    next: { day: 2, offset: 0, minute: 1380, temp: 16 },
  });
  assert.deepEqual(scheduleNow(raw, { day: 6, minute: 23 * 60 + 30 }), {
    active: 16,
    next: { day: 0, offset: 1, minute: 420, temp: 19 },
  });
});
