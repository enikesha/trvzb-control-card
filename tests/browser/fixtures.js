/** Synthetic entities keep browser regressions isolated from a real valve. */
export function radiatorStates() {
  const entities = {};
  const entity = (id, state, attributes = {}) => {
    entities[id] = { entity_id: id, state, attributes };
  };
  entity("climate.living_room_radiator", "heat", {
    temperature: 20,
    current_temperature: 19.8,
    hvac_action: "idle",
    hvac_modes: ["off", "auto", "heat"],
    min_temp: 4,
    max_temp: 35,
    target_temp_step: 0.5,
  });
  entity(
    "number.living_room_radiator_timer_mode_target_temperature",
    "unknown",
  );
  entity("number.living_room_radiator_temporary_mode_duration", "0");
  entity("select.living_room_radiator_temporary_mode", "boost", {
    options: ["boost", "timer"],
  });
  entity("sensor.living_room_radiator_battery", "100");
  entity("switch.living_room_radiator_child_lock", "off");
  entity("switch.living_room_radiator_open_window", "off");
  entity("select.living_room_radiator_temperature_sensor", "external", {
    options: ["internal", "external"],
  });
  entity("number.living_room_radiator_frost_protection_temperature", "7", {
    min: 4,
    max: 35,
    step: 0.5,
  });
  for (const day of [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]) {
    entity(
      `text.living_room_radiator_weekly_schedule_${day}`,
      "00:00/16 07:00/19 10:00/16 17:00/19 23:00/16",
    );
  }
  return entities;
}
