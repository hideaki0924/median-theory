# Single-file workflow (2026-11-21)

**Intended flow:** The user sends racecard/history/training/odds to ChatGPT. Assistant validates and consolidates once into ONE private `HORSE_RESEARCH_BUNDLE_V1.json`; user imports only that file. Browser lets user select venue and race, auto-populates all existing research inputs without individual file upload. Existing algorithms/official sources are retained and missing fields remain HOLD.

## Minimal contract

```json
{
  "schema":"HORSE_RESEARCH_BUNDLE_V1",
  "races":[
    {
      "data": { "schema":"TARGET_V86_UPCOMING_RACE_V1", "past_fields":[], "race":{} },
      "wood_csv":"...", "hill_csv":"...", "official_csv":"...", "twin_csv":"...",
      "win_odds_csv":"...", "single_odds_csv":"...", "multi_odds_csv":"..."
    }
  ]
}
```

`data` must contain a fully validated V87/V88 race object, all runners with official IDs, and up to 10 pre-race observations per runner in the frozen field order. Optional CSV fields contain text with original headers and all observations before cutoff. Do not manufacture missing names/IDs/runs, training flags, or odds. Missing inputs are omitted, not approximated.

## What was actually implemented and tested

- `research-ai/single-bundle-import.js` validates schema, dates, runner count, IDs, pre-race dates and strictly linked history; chooses first venue/race and supports selection of other bundle races.
- Browser creates temporary local `File` objects for optional embedded CSV and routes them to legacy V91/V92/V95/V96 modules; dispatches verified `v86-upcoming-import` to V93-V107. No private CSV or JSON is pushed to GitHub.
- UI defaults to ONE upload + venue + race + analyze. Old manual input panels are hidden behind an advanced toggle, not deleted.
- Executed mock-DOM regression: a two-runner bundle with official training CSV was read, race selected, event emitted, and the training file assigned. No real iPhone Safari E2E yet.

## Blockers to a truthful production data bundle

- Stored prior work includes Nov 21 three-race/48-runner HTML and Nov 14-15 DUAL31 history, but these alone do not constitute a complete, up-to-date V87 strict ID racecard + official SOURCE + current odds for every target race.
- The required actual target race and its authoritative source CSV files must be identified before building and presenting a production bundle. This is the assistant-side consolidation task, not a repeated user entry task.
