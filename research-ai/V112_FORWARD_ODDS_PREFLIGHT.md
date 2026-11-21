# V112 Public Odds Forward Safety Hardening — 2026-11-21

## Implementation
- Preserve a separate `<race_id>.prerace.json` only when the **source timestamp** predates the confirmed scheduled start **and** the collector itself is running before that start. Newer validated pre-race snapshots replace older ones; later post-start odds cannot overwrite the saved pre-race snapshot.
- Keep current `<race_id>.json` as a separately labeled current status (including post_start or unavailable).
- On race switch and on every new odds refresh attempt, invalidate any previous `live-single-place.csv` and `live-win.csv` browser input. Clear the displayed V96 analysis until a fresh all-runner verified capture is available. Historical bundled source files are not falsely labeled live.
- Poll only races with a confirmed date of today or tomorrow in JST; skip completed target races without deleting their public saved status.
- Run the scheduled public polling on Monday as well as Saturday/Sunday, to cover holiday racing.

## Real server status
- 2026-11-22 Kyoto 1R (202608050601) and Tokyo 1R (202605050501) were checked on the previous evening: both `unavailable`, no live single/place feed. Upstream netkeiba returned `yoso` (prediction mode), SportsNavi fallback had no parseable win/place HTML.
- Therefore no live odds were inserted in the user's V96 median analysis.

## Tests
- Mocked actual GitHub `unavailable` data in the live odds browser source; tested its event handlers with a prior live file present. Previous live inputs were cleared, V107 requested a refresh, and unavailable condition visibly HOLDed. JS syntax PASS.
- GitHub committed code for the pre-race snapshot preservation and time-windowed polling. Direct end-to-end observation of tomorrow's **actual released** odds is still pending; do not claim it passed.
- Current private one-file bundle contains Nov 21 Fukushima/Kyoto races, not Nov 22 Tokyo/Kyoto. **Do not substitute a selected Nov21 runner list for a Nov22 odds feed**.

## Remaining blockers
- A Nov22 racecard and prior 10-race histories are required to analyze Nov22 racers; acquire them from user datasets or available reliable official records, never fabricate IDs/horse names.
- Validate fresh all-runner single/place availability with official start time, source timestamp and runner names before marking a real pre-race pass.
