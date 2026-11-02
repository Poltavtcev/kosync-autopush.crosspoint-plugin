# KOSync Auto-push for CrossPoint

![AI generated: 100%](https://img.shields.io/badge/AI%20generated-100%25-blueviolet)

A [CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader) SD-card plugin that pushes reading
progress to a KOSync server automatically when the reader goes to sleep.

It uses only the firmware's declarative `reader.session` event handler (no code runs on the device) plus a
small browser settings card. See [`kosync-autopush.crosspoint-plugin/README.md`](kosync-autopush.crosspoint-plugin/README.md)
for setup and limits.

## Install

- **Plugin Hub:** Home -> Plugins -> Plugin Hub -> Community Plugins -> KOSync Auto-push.
- **Manually:** copy `kosync-autopush.crosspoint-plugin/` to `/.crosspoint/plugins/kosync-autopush/` on the SD card.

Restart the reader once after installing, then configure it in the web UI under Plugins.

## Limits

Upload only, percentage only (no KOReader XPath). Pull still uses the built-in Sync Progress.

## Releasing

1. Bump `version` in `kosync-autopush.crosspoint-plugin/manifest.json`.
2. Commit, then publish a GitHub Release tagged `vX.Y.Z` with the same version.

Plugin Hub picks up new releases within about three hours.

## License

MIT
