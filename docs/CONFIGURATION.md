# Configuration reference

Start with the [README example](../README.md#add-the-card). The options below are for installations where the default entity IDs do not match the valve's entities, or for supplying initial temperature presets in YAML.

## Entity IDs

The card derives related entity IDs from the climate entity's name. With `entity: climate.example_radiator`, it looks for:

| Option | Default entity ID |
| --- | --- |
| `battery_entity` | `sensor.example_radiator_battery` |
| `source_entity` | `select.example_radiator_temperature_sensor` |
| `lock_entity` | `switch.example_radiator_child_lock` |
| `window_entity` | `switch.example_radiator_open_window` |
| `frost_entity` | `number.example_radiator_frost_protection_temperature` |
| `timer_target_entity` | `number.example_radiator_timer_mode_target_temperature` |
| `timer_duration_entity` | `number.example_radiator_temporary_mode_duration` |
| `timer_mode_entity` | `select.example_radiator_temporary_mode` |

For example, if the battery entity has a different name, add:

```yaml
battery_entity: sensor.radiator_battery_level
```

For weekly schedules, the defaults are `text.example_radiator_weekly_schedule_monday` through `text.example_radiator_weekly_schedule_sunday`. To override them, supply all seven IDs in Monday-to-Sunday order:

```yaml
schedule_entities:
  - text.radiator_schedule_monday
  - text.radiator_schedule_tuesday
  - text.radiator_schedule_wednesday
  - text.radiator_schedule_thursday
  - text.radiator_schedule_friday
  - text.radiator_schedule_saturday
  - text.radiator_schedule_sunday
```

Use the existing entities for your valve. If a schedule or timer control is missing from Home Assistant, check that it is enabled on the device's entity list and that your firmware and Zigbee2MQTT versions support it.

## Initial temperature presets

You can create presets in the card or supply them in its configuration:

```yaml
temperatures:
  - id: sleep
    name: Sleep
    temp: 18
  - id: comfort
    name: Comfort
    temp: 21
```

Each preset needs a unique `id`, a display `name`, and a `temp` in °C. Names are displayed as entered. Temperature values must be between 4 and 35 °C in 0.5 °C steps.

The card also reads temperatures already used in the valve's schedule. Changes made in the schedule editor are saved to the card's dashboard configuration, alongside the times and temperatures sent to the valve.

## Card not found after installation

If Home Assistant reports **Custom element doesn't exist: trvzb-control-card**, open **Settings → Dashboards → ⋮ → Resources** and check for a **JavaScript module** entry at the appropriate URL:

- HACS: `/hacsfiles/trvzb-control-card/trvzb-control-card.js`
- Manual installation: `/local/trvzb-control-card.js?v=0.3.0`

Add the entry if it is missing, then reload Home Assistant in your browser or app. If **Resources** is hidden, enable **Advanced mode** in your Home Assistant user profile.
