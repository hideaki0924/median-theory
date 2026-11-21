#!/usr/bin/env python3
"""Fetch publicly visible netkeiba JRA win/place odds into GitHub Pages static feed.

Public odds ONLY. No personal TARGET or training data. Fail closed on incomplete data.
This is a best-effort community endpoint; verify actual upstream availability.
"""
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from fetch_sportsnavi_odds import fetch as sportsnavi_fetch

ROOT = pathlib.Path(__file__).resolve().parents[1]
FEED = ROOT / "odds-live"
JST = dt.timezone(dt.timedelta(hours=9))
API = "https://race.netkeiba.com/api/api_get_jra_odds.html"
VALID_ID = re.compile(r"^20\d{10}$")
VENUES = {"01":"札幌","02":"函館","03":"福島","04":"新潟","05":"東京",
          "06":"中山","07":"中京","08":"京都","09":"阪神","10":"小倉"}
MAX_BYTES = 1_500_000

def number(x):
    try:
        if x is None or str(x).strip() in ("", "---.-", "**", "--"):
            return None
        z = float(str(x).strip())
        return z if z >= 1 and z < 1_000_000 and z != float("inf") else None
    except (ValueError, TypeError, OverflowError):
        return None

def parse_api(payload, race_id, now=None):
    now = now or dt.datetime.now(JST)
    if not isinstance(payload, dict) or payload.get("status") not in ("result", "OK", "ok"):
        raise ValueError("netkeiba API status=" + repr(payload.get("status"))[:80] + " reason=" + repr(payload.get("reason"))[:100])
    data = payload.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("odds"), dict):
        raise ValueError("netkeiba API odds are missing")
    prices = data["odds"]
    wins = prices.get("1") or {}
    places = prices.get("2") or {}
    if not isinstance(wins, dict) or not isinstance(places, dict):
        raise ValueError("netkeiba win/place tables are missing")
    entries = []
    for key, values in wins.items():
        if not str(key).isdigit():
            continue
        horse_no = int(key)
        if not 1 <= horse_no <= 28 or not isinstance(values, (list, tuple)) or not values:
            continue
        win = number(values[0])
        pv = places.get(key, places.get(str(horse_no).zfill(2)))
        upper = number(pv[1]) if isinstance(pv, (list, tuple)) and len(pv) >= 2 else None
        lower = number(pv[0]) if isinstance(pv, (list, tuple)) and pv else None
        if win is None:
            continue
        entries.append({"horse_number": horse_no, "win_odds": win,
                        "place_lower": lower, "place_upper": upper})
    entries.sort(key=lambda r: r["horse_number"])
    if len(entries) < 2:
        raise ValueError("API returned fewer than two priced horses")
    if len(set(row["horse_number"] for row in entries)) != len(entries):
        raise ValueError("horse numbers not unique")
    official = str(data.get("official_datetime") or "").strip()
    return {"schema":"NETKEIBA_LIVE_ODDS_V1", "source":"netkeiba_jra_odds_api",
            "race_id":race_id,"venue":VENUES[race_id[4:6]], "race_no":int(race_id[-2:]),
            "fetched_at":now.isoformat(timespec="seconds"),"official_datetime":official,
            "status":"partial" if any(x["place_upper"] is None for x in entries) else "available",
            "odds":entries, "horse_count":len(entries),
            "note":"Public netkeiba odds; not JRA official. Check full field and capture time before use."}

def fetch(race_id, action="init"):
    if not VALID_ID.fullmatch(race_id) or race_id[4:6] not in VENUES:
        raise ValueError("invalid JRA race ID")
    query = urllib.parse.urlencode({"race_id": race_id, "type":"1",
                                    "action":action})
    req = urllib.request.Request(API+"?"+query, headers={
        "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer":"https://race.netkeiba.com/odds/index.html?race_id="+race_id,
        "Accept":"application/json, text/javascript, */*"})
    with urllib.request.urlopen(req, timeout=18) as resp:
        if resp.status != 200:
            raise ValueError("HTTP "+str(resp.status))
        content = resp.read(MAX_BYTES+1)
        if len(content)>MAX_BYTES:
            raise ValueError("response too large")
    body = content.decode("utf-8-sig").strip()
    if not body.startswith("{"):
        matched = re.fullmatch(r"[\w$]+\((\{.*\})\);?", body, flags=re.DOTALL)
        if not matched:
            raise ValueError("upstream is not JSON")
        body = matched.group(1)
    return parse_api(json.loads(body),race_id)

def main():
    config = json.loads((FEED/"targets.json").read_text(encoding="utf8"))
    targets = config.get("race_ids", [])
    if not isinstance(targets,list) or len(targets)>36:
        raise ValueError("invalid target list")
    any_good = False
    for race_id in targets:
        if not isinstance(race_id,str) or not VALID_ID.fullmatch(race_id):
            raise ValueError("invalid race_id")
        scheduled_date = config.get("race_dates", {}).get(race_id)
        if not scheduled_date:
            print(race_id, "HOLD: race date not registered", file=sys.stderr)
            continue
        try:
            race_day = dt.date.fromisoformat(scheduled_date)
        except ValueError:
            print(race_id, "HOLD: invalid date", file=sys.stderr)
            continue
        local_day = dt.datetime.now(JST).date()
        # Request a race only on the day before or the exact race day.
        # Retain existing old snapshots, but stop wasteful repeated requests for expired races.
        if race_day < local_day or race_day > local_day + dt.timedelta(days=1):
            continue
        path = FEED/(race_id+".json")
        try:
            try:
                item = fetch(race_id, "init")
            except Exception as first_error:
                try:
                    item = fetch(race_id, "update")
                except Exception as second_error:
                    try:
                        item = sportsnavi_fetch(race_id)
                        print(race_id, "SPORTSNAVI_BACKUP", item["status"], len(item["odds"]))
                    except Exception as third_error:
                        raise ValueError("netkeiba=" + str(second_error)[:110] + "; SportsNavi=" + str(third_error)[:120]) from third_error
            item["date"] = config.get("race_dates", {}).get(race_id, "")
            # A bookmaker timestamp after scheduled start is never pre-race evidence.
            official_raw = item.get("official_datetime", "")
            off_raw = config.get("race_start_times", {}).get(race_id)
            if off_raw and official_raw:
                try:
                    quote_at = dt.datetime.fromisoformat(official_raw.replace(" ", "T"))
                    quote_at = quote_at.replace(tzinfo=JST) if quote_at.tzinfo is None else quote_at
                    off_at = dt.datetime.fromisoformat(off_raw)
                    if quote_at > off_at:
                        item["status"] = "post_start"
                        item["note"] = "Odds timestamp is later than race scheduled start; research display ONLY, not pre-race analysis."
                except ValueError:
                    item["status"] = "unverified_time"
                    item["note"] = "Unable to verify odds timestamp relative to scheduled start."
            item["race_start_at"] = off_raw or ""
            # Preserve one independent last VERIFIED pre-race odds snapshot.
            # The public current-state file may later become 'post_start';
            # the retrospective snapshot must never be replaced by post-off data.
            if off_raw and item.get("status") == "available" and official_raw:
                try:
                    source_time = dt.datetime.fromisoformat(official_raw.replace(" ", "T"))
                    source_time = source_time.replace(tzinfo=JST) if source_time.tzinfo is None else source_time
                    cutoff = dt.datetime.fromisoformat(off_raw)
                    if source_time < cutoff and dt.datetime.now(JST) < cutoff:
                        frozen = FEED / (race_id + ".prerace.json")
                        previous_at = None
                        if frozen.exists():
                            previous = json.loads(frozen.read_text(encoding="utf8"))
                            old_raw = previous.get("official_datetime", "")
                            if old_raw:
                                previous_at = dt.datetime.fromisoformat(old_raw.replace(" ", "T"))
                                previous_at = previous_at.replace(tzinfo=JST) if previous_at.tzinfo is None else previous_at
                        if previous_at is None or source_time > previous_at:
                            frozen.write_text(json.dumps(item, ensure_ascii=False, indent=2)+"\n",encoding="utf8")
                            print(race_id,"PREFLIGHT_SNAPSHOT_SAVED",source_time.isoformat())
                except (ValueError, TypeError, json.JSONDecodeError) as invalid:
                    print(race_id,"PREFLIGHT_SNAPSHOT_HOLD",str(invalid)[:140],file=sys.stderr)
            path.write_text(json.dumps(item, ensure_ascii=False, indent=2)+"\n",encoding="utf8")
            print(race_id, item["status"], len(item["odds"]), item["official_datetime"])
            any_good = True
        except Exception as ex:
            # Never invent odds; publish an error record to avoid unexplained 404.
            print(race_id,"UNAVAILABLE",type(ex).__name__,str(ex)[:200],file=sys.stderr)
            if (not path.exists()) or json.loads(path.read_text(encoding="utf8")).get("status") == "unavailable":
                record = {
                    "schema": "NETKEIBA_LIVE_ODDS_V1",
                    "race_id": race_id,
                    "date": config.get("race_dates", {}).get(race_id, ""),
                    "status": "unavailable",
                    "fetched_at": dt.datetime.now(JST).isoformat(timespec="seconds"),
                    "horse_count": 0, "odds": [],
                    "reason": type(ex).__name__ + ": " + str(ex)[:180]
                }
                path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    return 0 if any_good else 0  # Action may have no new odds; keep previous snapshot with original timestamp.

if __name__ == "__main__":
    sys.exit(main())
