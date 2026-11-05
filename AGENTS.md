# Project conventions

- Write source code, comments, documentation, and commit messages in English.
- English is the source UI language and the fallback for unsupported locales or missing keys.
- Put user-facing text, validation messages, and accessibility labels in `src/locales/en.json`; provide Russian in `src/locales/ru.json`.
- For the future HA card, read the current user's language from `hass.locale.language` or `hass.language`. Do not use the server's language as the user's language.
- Preserve user-entered names. Only built-in preset labels are translated.
- Production sources are in `src/`, separate from `prototype/control.template.html`. Keep time conversion and schedule validation out of HTML templates. Run `npm run build` to regenerate `prototype/control.html`. Do not hand-edit generated `prototype/control.html` or `dist/trvzb-control-card.js`.
- Keep the prototype disconnected from HA until live integration is explicitly requested. Never store tokens or secrets in this repository.

- Never use OS-native `input[type=time]` in the live schedule editor: explicit HA time preferences must win over browser settings.
- Preserve input nodes and invalid text drafts while typing. Block saving until the draft is valid; do not silently revert user input.
- Preset IDs are UI identifiers, not secrets. Their generation must work on HTTP/LAN origins without secure-context APIs.

- Default to a 24-hour clock. Do not infer AM/PM from English UI text, region, or the browser. Only an explicit HA 12-hour preference enables AM/PM.

- Write public documentation for the person installing and using the card. Explain setup, behavior, and actionable limitations; omit implementation narration, testing provenance, and conversation history. Keep contributor and release procedures in their dedicated guides.
