let nextId = 0;

/** UI identifiers are not credentials and must also work on HTTP/LAN origins. */
export function createPresetId(existingIds = []) {
  const existing = new Set(existingIds);
  let id;
  do {
    nextId += 1;
    id = `custom-${Date.now().toString(36)}-${nextId.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (existing.has(id));
  return id;
}
