# KOSync Auto-push

Pushes your reading progress to a KOSync server automatically when the reader goes to sleep. No tapping and no browser needed.

## How it works

- After a reading session, the reader briefly joins your saved WiFi on sleep (max 10 s, battery 20% or more) and uploads the progress.
- If WiFi is unavailable, the push waits for the next sleep or WiFi connection.
- Works with sync.crosspointreader.com, sync.koreader.rocks or a self-hosted KOSync server.

## Limits

- **Upload only.** Use Sync Progress in the reader menu to pull.
- **Percentage only**, not the exact KOReader position. KOReader may jump to the start of the book, so set its "Sync to a newer state" to Prompt or Disable.
- Books are matched by the binary document hash (the KOReader default).

## Setup

- Restart the reader once after installing.
- In the web UI, open Plugins, fill in KOSync Auto-push, press Test login, then Save.
