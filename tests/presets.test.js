import test from "node:test";
import assert from "node:assert/strict";
import { createPresetId } from "../src/presets.js";

test("preset identifiers work when secure-context crypto APIs are absent", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    value: undefined,
    configurable: true,
  });
  try {
    const ids = [];
    for (let i = 0; i < 1000; i += 1) ids.push(createPresetId(ids));
    assert.equal(new Set(ids).size, 1000);
    assert.ok(ids.every((id) => /^custom-[a-z0-9-]+$/.test(id)));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else delete globalThis.crypto;
  }
});
