# whatsapp-bridge-addon

A Home Assistant Supervisor add-on repository. Text "Status" on WhatsApp from
an allow-listed number, get back a formatted summary of home status: gate,
battery/power source, geysers (with a shower recommendation), air quality,
air purifiers, and weather.

## What this is

This repo is a standard [Home Assistant add-on repository](https://www.home-assistant.io/addons/tutorial/):
`repository.yaml` at the root, and `whatsapp_status_bridge/` as the add-on
itself. Point Supervisor at this repo's URL and it handles install, update,
and rebuild — no manual file copying.

## Installing

1. In Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ (top right) →
   Repositories**.
2. Paste this repo's URL and add it.
3. Find **WhatsApp Status Bridge** in the store and install it.
4. See [`whatsapp_status_bridge/DOCS.md`](whatsapp_status_bridge/DOCS.md) for
   configuration (setting `allowed_numbers`) and pairing (scanning the QR code
   printed in the add-on's log).

## Architecture

- **Baileys** (`@whiskeysockets/baileys`) for WhatsApp connectivity — pure
  JS/TypeScript, no browser/Puppeteer dependency, so the add-on stays
  lightweight.
- Talks to Home Assistant via the Supervisor-proxied REST API
  (`http://supervisor/core/api`), authenticated with the `SUPERVISOR_TOKEN`
  Supervisor automatically injects — no manually-created Long-Lived Access
  Token, no secrets stored in this repo.
- No Home Assistant `/config` changes of any kind — this add-on is entirely
  self-contained.

Full design rationale and the implementation plan that built this are
preserved in the `home_assistant` config repo at
`docs/plans/2026-09-04-whatsapp-status-bridge-design.md` and the matching
`-plan.md`, including the icon/threshold tables, message format, and the
production bugs found and fixed during live verification (WhatsApp's LID
addressing affecting both self-chat and third-party senders).

## Development

```bash
cd whatsapp_status_bridge
npm install
npm test
```

No credentials are required to run the test suite — `haClient` and the
WhatsApp connection are both dependency-injected/mocked in tests.
