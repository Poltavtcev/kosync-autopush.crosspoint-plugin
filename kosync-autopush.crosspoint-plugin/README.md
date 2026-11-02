KOSync Auto-push
================

Pushes your reading progress to a KOSync server automatically when the reader
goes to sleep. Nothing to tap: read, press sleep, done.

What it does
------------
When you finish a reading turn and the device sleeps, it briefly joins your
last WiFi network (max 10 s, only with battery at 20% or more), uploads the
book's progress, shows "KOSync: progress pushed" and sleeps. If WiFi is not
available, the push waits and is sent on the next sleep or WiFi connection.

Limits
------
- Upload only. To pull progress from another device, open the reader menu
  and use Sync Progress as usual.
- Only a percentage is sent, not the exact KOReader position. Another
  CrossPoint device lands on roughly the same page. KOReader cannot use a
  percentage-only record and may jump to the start of the book: set
  KOReader's "Sync to a newer state" to "Prompt" or "Disable".
- A session must be at least 10 seconds of reading, and the clock must have
  been set once (any WiFi connection does that).
- Books are matched by the binary (partial MD5) document hash, the KOReader
  default.

Setup
-----
1. Copy this folder to /.crosspoint/plugins/kosync-autopush on the SD card
   (or /plugins/kosync-autopush).
2. Restart the reader once.
3. Start File Transfer, open the web UI, go to Plugins, and fill in
   KOSync Auto-push: server URL, username, password, device name.
   Press "Test login", then "Save".
4. Make sure the reader has a saved WiFi network.

The settings are stored in config.json in this folder.
