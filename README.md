# whatsapp-bridge-addon

A [Home Assistant](https://www.home-assistant.io/) Supervisor add-on repository.
Text **"Status"** on WhatsApp from an allow-listed number and get back a
formatted summary of home status: gate, battery/power source, geysers (with a
shower recommendation), air quality, air purifiers, and weather.

```
🏠 *Home Status*
📅 Fri, 04 Sep 2026 — 14:32
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

☀️ Weather: *24°C, Sunny*

_😎 Sunopsis: Sunny and smug about it. SPF up, excuses down. ☀️😎_
──────────

🚪 Gate: *Closed* 🟢
──────────

🔋 Battery: *82%* 🟢

_⚡ Power Check: On Eskom — treating ourselves to some grid power today_
──────────

♨️ Main Geyser: *45°C* 🟢
♨️ Second Geyser: *30°C* 🔴

_🚿 Shower Call: Main Geyser — the other one's still sulking in the cold 🥶_
──────────

😷 PM2.5: *12 µg/m³* 🟢
🌬️ CO2: *650 ppm* 🟢
──────────

💨 Air Purifier 1: *Auto* 🟢
💨 Air Purifier 2: *Auto* 🟢
```

## Features

- **One trigger word.** Text "Status" from an allow-listed WhatsApp number,
  get a formatted reply back — no app, no dashboard, no VPN.
- **Allow-list, not open access.** Only numbers you list in the add-on's
  configuration can trigger a reply; everyone else is silently ignored.
- **Self-contained.** Runs entirely as a Supervisor add-on — no changes to
  Home Assistant's `/config`, no manually-created Long-Lived Access Token, no
  secrets committed to this repo.
- **Lightweight.** Uses [Baileys](https://github.com/WhiskeySockets/Baileys)
  for WhatsApp connectivity — pure JS/TypeScript, no headless-browser
  dependency.
- **Resilient by default.** Reconnects automatically on disconnect, and
  reports "Home Assistant isn't responding" rather than a broken partial
  reply if the Supervisor API is unreachable.
- **Configurable thresholds.** Battery, PM2.5, CO2, geyser and grid-import
  thresholds all live in the add-on's Configuration tab — no code edits
  needed for tuning.

## What this is

This repo is a standard [Home Assistant add-on repository](https://www.home-assistant.io/addons/tutorial/):
`repository.yaml` at the root, and `whatsapp_status_bridge/` as the add-on
itself. Point Supervisor at this repo's URL and it handles install, update,
and rebuild — no manual file copying.

## Before you install: this add-on hardcodes one household's entities

The set of Home Assistant entities the bridge reports on — the gate,
geysers, purifiers, battery/grid sensors, air quality sensors — is a fixed
list in [`whatsapp_status_bridge/src/buildStatusMessage.js`](whatsapp_status_bridge/src/buildStatusMessage.js)
(see the `ENTITIES` map near the top of the file). This add-on was built for
one specific Home Assistant setup, not as a generic templated integration.

To use it against your own instance, fork this repo and edit that `ENTITIES`
map (and the corresponding sections further down the file that reference
them) to point at your own entity IDs — anything referenced there that
doesn't exist on your system will just render as `N/A` in the reply rather
than erroring, so partial adaptation is safe to test incrementally.

## Installing

1. In Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ (top right) →
   Repositories**.
2. Paste this repo's URL and add it.
3. Find **WhatsApp Status Bridge** in the store and install it.
4. Open the add-on's **Configuration** tab and set `allowed_numbers` to a
   comma-separated list of WhatsApp numbers (international format, no `+`,
   e.g. `27821234567`) that are allowed to trigger a status reply. **This
   must be set before the first start** — the add-on exits immediately with
   an error if `allowed_numbers` is empty, rather than silently sitting idle.
5. Adjust the other threshold options if the defaults don't suit your setup
   (all documented in [`whatsapp_status_bridge/DOCS.md`](whatsapp_status_bridge/DOCS.md)).
6. Start the add-on and open its **Log** tab — a QR code prints there.
7. Scan it with WhatsApp (**Linked Devices → Link a Device**) from the
   account you want the bridge to send/receive as.
8. Once linked, text "Status" from one of the allowed numbers to that
   WhatsApp account.

See [`whatsapp_status_bridge/DOCS.md`](whatsapp_status_bridge/DOCS.md) for
the full configuration option reference and re-pairing instructions.

### Updating

Supervisor checks this repo for new releases the same way it does for any
add-on repository — when a new version of `whatsapp_status_bridge` is
published, an update becomes available under **Settings → Add-ons →
WhatsApp Status Bridge**. The paired WhatsApp session persists across
updates; you won't need to re-scan the QR code.

### Uninstalling

Stop and uninstall the add-on from its page under **Settings → Add-ons →
WhatsApp Status Bridge**, then remove the repository under **Add-on Store →
⋮ → Repositories** if you no longer want it listed. Uninstalling does not
touch anything in Home Assistant's `/config`, since the add-on never writes
there.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Add-on exits immediately on start | `allowed_numbers` is empty — set it in the Configuration tab first |
| No QR code appears in the log | The add-on already has a paired session in `/data/baileys_auth`; delete that directory and restart to force re-pairing |
| "Status" gets no reply | Sending number isn't in `allowed_numbers` (check for stray spaces/formatting), or Home Assistant is unreachable — check the Log tab |
| Reply says "Home Assistant isn't responding right now" | The Supervisor API is unreachable — check Home Assistant Core's own health, not the add-on |

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

## Contributing

Issues and pull requests are welcome. Since the entity list is tailored to
one household's setup (see above), contributions that generalize
`ENTITIES` into add-on configuration options rather than hardcoded entity
IDs are especially useful.

## License

[MIT](LICENSE) © Stephan Marais
