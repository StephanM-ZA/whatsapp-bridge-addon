# WhatsApp Status Bridge

Send "Status" on WhatsApp from an allowed number to get back a summary of:
gate, battery/power source, both geysers (with a shower recommendation),
air quality, air purifiers, and weather.

## Setup

1. Set `allowed_numbers` in this add-on's Configuration tab to a comma-separated
   list of WhatsApp numbers (international format, no `+`, e.g. `27821234567`)
   that are allowed to trigger a status reply. **This must be set before the
   first start** — if `allowed_numbers` is left empty, the add-on exits
   immediately with an error instead of silently showing a QR code.
2. Set `link_phone_number` to the WhatsApp number you want the bridge to
   link as (international format, no `+`, e.g. `27821234567`) — this is
   **strongly recommended**: the alternative (leaving it blank) prints a QR
   code in the Log tab, and WhatsApp's QR payload is dense enough that it
   often doesn't fit in a log viewer's width.
3. Start the add-on and open its Log tab. With `link_phone_number` set, it
   prints a short pairing code instead of a QR — enter it in WhatsApp:
   Settings → Linked Devices → Link a Device → **Link with phone number
   instead**. (If `link_phone_number` is left blank, scan the printed QR
   code from Linked Devices → Link a Device instead.)
4. Once linked, text "Status" from one of the allowed numbers to that WhatsApp
   account.

To force re-pairing (e.g. the linked device was removed, or you want to link a
different WhatsApp account), delete the `/data/baileys_auth` directory and
restart the add-on — it will print a fresh QR code on the next start.

## Options

| Option | Meaning | Default |
|---|---|---|
| `allowed_numbers` | Comma-separated numbers allowed to trigger a reply | `""` (none — must be set) |
| `link_phone_number` | WhatsApp number to link the bridge as, via a typed-in pairing code instead of a QR scan | `""` (blank falls back to QR) |
| `battery_low_pct` | Battery % below which the icon turns red | `20` |
| `pm25_threshold` | PM2.5 µg/m³ at/above which the icon turns red | `22` |
| `co2_threshold` | CO2 ppm at/above which the icon turns red | `800` |
| `shower_temp_c` | Geyser °C at/above which it's "shower ready" | `35` |
| `grid_import_threshold_w` | Grid import (W) above which Power Check says "On Eskom" | `100` |
| `solar_forecast_high_kwh` | Forecast remaining (kWh) above which Power Check calls it abundant | `10` |
