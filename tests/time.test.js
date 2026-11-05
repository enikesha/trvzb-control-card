import test from "node:test";
import assert from "node:assert/strict";
import {
  uses12HourClock,
  displayTime,
  parseTimeInput,
  formatClockTime,
} from "../src/time.js";

test("24-hour default is independent of English language and browser locale", () => {
  assert.equal(uses12HourClock(), false);
  assert.equal(uses12HourClock({ language: "en" }), false);
  assert.equal(
    uses12HourClock({ language: "en-US", time_format: "system" }),
    false,
  );
  assert.equal(
    uses12HourClock({ language: "en-US", time_format: "24" }, "en-US"),
    false,
  );
  assert.equal(
    uses12HourClock({ language: "en-GB", time_format: "12" }, "en-GB"),
    true,
  );
  assert.equal(
    uses12HourClock({ language: "en-GB", time_format: "language" }),
    false,
  );
  assert.equal(
    uses12HourClock({ language: "en-US", time_format: "language" }),
    false,
  );
  assert.equal(
    uses12HourClock({ language: "en-US", time_format: "system" }, "en-GB"),
    false,
  );
});

test("24-hour input accepts afternoon times, shorthand and midnight boundaries", () => {
  assert.equal(parseTimeInput("18:30"), "18:30");
  assert.equal(parseTimeInput("6:05"), "06:05");
  assert.equal(parseTimeInput("1830"), "18:30");
  assert.equal(parseTimeInput("605"), "06:05");
  assert.equal(parseTimeInput("24:00", { isEnd: true }), "24:00");
  assert.equal(parseTimeInput("00:00", { isEnd: true }), "24:00");
  assert.equal(parseTimeInput("00:00"), "00:00");
  for (const value of ["24:00", "25:00", "12:60", "12:", "12:30 PM", "foo"]) {
    assert.throws(() => parseTimeInput(value), /invalid_time_24/);
  }
});

test("12-hour input distinguishes noon and midnight without changing canonical storage", () => {
  const parse = (text, meridiem, isEnd = false) =>
    parseTimeInput(text, { use12Hours: true, meridiem, isEnd });
  assert.equal(parse("12:00", "AM"), "00:00");
  assert.equal(parse("12:00", "PM"), "12:00");
  assert.equal(parse("11:30", "PM"), "23:30");
  assert.equal(parse("12:00", "AM", true), "24:00");
  assert.throws(() => parse("13:00", "PM"), /invalid_time_12/);
  assert.throws(() => parse("00:00", "AM"), /invalid_time_12/);
});

test("clock display round-trips every minute in either format", () => {
  for (let minute = 0; minute < 1440; minute += 1) {
    const value = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    for (const use12Hours of [false, true]) {
      const display = displayTime(value, use12Hours);
      assert.equal(
        parseTimeInput(display.text, {
          use12Hours,
          meridiem: display.meridiem,
        }),
        value,
      );
    }
  }
  assert.equal(formatClockTime("23:00", true), "11:00 PM");
  assert.equal(formatClockTime("23:00", false), "23:00");
  assert.equal(displayTime("24:00", false).text, "24:00");
});
