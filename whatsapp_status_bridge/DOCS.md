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
2. Start the add-on and open its Log tab — a QR code will be printed there.
3. Scan it with WhatsApp (Linked Devices → Link a Device) from the account you
   want the bridge to send/receive as.
4. Once linked, text "Status" from one of the allowed numbers to that WhatsApp
   account.

To force re-pairing (e.g. the linked device was removed, or you want to link a
different WhatsApp account), delete the `/data/baileys_auth` directory and
restart the add-on — it will print a fresh QR code on the next start.

## Options

| Option | Meaning | Default |
|---|---|---|
| `allowed_numbers` | Comma-separated numbers allowed to trigger a reply | `""` (none — must be set) |
| `battery_low_pct` | Battery % below which the icon turns red | `20` |
| `pm25_threshold` | PM2.5 µg/m³ at/above which the icon turns red | `22` |
| `co2_threshold` | CO2 ppm at/above which the icon turns red | `800` |
| `shower_temp_c` | Geyser °C at/above which it's "shower ready" | `35` |
| `grid_import_threshold_w` | Grid import (W) above which Power Check says "On Eskom" | `100` |
| `solar_forecast_high_kwh` | Forecast remaining (kWh) above which Power Check calls it abundant | `10` |
