#!/usr/bin/env python3
"""SportsNavi public win/place backup for JRA races; fail closed.

Source is an HTML table and an explicitly printed updated-at timestamp.
No guessed prices, no JRA-official claims. Only use source-time, never fetch-time.
"""
import datetime as dt
import html
from html.parser import HTMLParser
import re
import urllib.request

JST = dt.timezone(dt.timedelta(hours=9))
NUM = re.compile(r"^\d+(?:\.\d+)?$")
RANGE = re.compile(r"^(\d+(?:\.\d+)?)\s*[-－–〜~]\s*(\d+(?:\.\d+)?)$")
DATE_STAMP = re.compile(r"20\d\d\s*/\s*\d{1,2}\s*/\s*\d{1,2}\s+\d{1,2}:\d{2}\s*更新")
MAX_BYTES = 2_500_000

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables=[]
        self.stack=[]
        self.row=None
        self.cell=None
        self.in_table=0
        self.raw_text=[]
    def handle_starttag(self,tag,attrs):
        if tag=="table":
            self.in_table+=1
            self.stack.append([])
        if self.in_table and tag=="tr":
            self.row=[]
        if self.in_table and tag in ("th","td"):
            self.cell=[]
    def handle_data(self,data):
        self.raw_text.append(data)
        if self.cell is not None:
            self.cell.append(data)
    def handle_endtag(self,tag):
        if self.in_table and tag in ("td","th") and self.cell is not None:
            if self.row is not None:
                self.row.append(" ".join(" ".join(self.cell).split()))
            self.cell=None
        if self.in_table and tag=="tr" and self.row is not None:
            self.stack[-1].append(self.row)
            self.row=None
        if tag=="table" and self.in_table:
            self.tables.append(self.stack.pop())
            self.in_table-=1

def odds_number(s):
    s=str(s).strip().replace(",","")
    return float(s) if NUM.fullmatch(s) and 1<=float(s)<1000000 else None

def parse_page(source,race_id,now=None):
    now=now or dt.datetime.now(JST)
    if not re.fullmatch(r"20\d{10}",race_id):
        raise ValueError("invalid race id")
    p=TableParser()
    p.feed(source)
    text=" ".join(p.raw_text)
    if "単勝" not in text or "複勝" not in text:
        raise ValueError("win/place labels missing")
    # Match only an update date printed by the odds provider.
    matches=list(DATE_STAMP.finditer(text))
    if not matches:
        raise ValueError("source odds update time not found")
    raw=matches[-1].group(0).replace("更新","").strip()
    moment=dt.datetime.strptime(re.sub(r"\s*/\s*","/",raw),"%Y/%m/%d %H:%M").replace(tzinfo=JST)
    # The site can show historical intermediate odds. Never call those live.
    if moment>now+dt.timedelta(minutes=10):
        raise ValueError("future odds timestamp")
    found=[]
    for table in p.tables:
        for i,head in enumerate(table):
            h=["".join(x.split()) for x in head]
            if not all(any(x==required for x in h) for required in ("馬番","馬名","単勝","複勝")):
                continue
            ix={k:h.index(k) for k in ("馬番","馬名","単勝","複勝")}
            entries=[]
            for row in table[i+1:]:
                if max(ix.values())>=len(row):continue
                hs=row[ix["馬番"]].strip()
                if not hs.isdigit():continue
                no=int(hs)
                if not 1<=no<=28:continue
                name=row[ix["馬名"]].strip()
                win=odds_number(row[ix["単勝"]])
                pr=RANGE.fullmatch(row[ix["複勝"]].replace(" ",""))
                if win is None or pr is None or not name: continue
                low=odds_number(pr.group(1));upper=odds_number(pr.group(2))
                if low is None or upper is None or low>upper: continue
                entries.append(dict(horse_number=no,horse_name=name,win_odds=win,place_lower=low,place_upper=upper))
            if len(entries)>len(found):
                found=entries
    if len(found)<2 or len(set(x["horse_number"] for x in found))!=len(found):
        raise ValueError("valid full win/place HTML table not found")
    found.sort(key=lambda x:x["horse_number"])
    date=moment.strftime("%Y-%m-%d %H:%M:%S")
    staleness=(now-moment).total_seconds()/60
    return dict(schema="NETKEIBA_LIVE_ODDS_V1",race_id=race_id,
                source="sports_yahoo_co_jp",source_url="https://sports.yahoo.co.jp/keiba/race/odds/tfw/"+race_id[2:],
                fetched_at=now.isoformat(timespec="seconds"),
                official_datetime=date,odds=found,horse_count=len(found),
                status="available" if 0<=staleness<=30 else "stale",
                note="SportsNavi intermediate odds (not JRA final). Source timestamp may be old.")

def fetch(race_id):
    url="https://sports.yahoo.co.jp/keiba/race/odds/tfw/"+race_id[2:]
    request=urllib.request.Request(url,headers={
        "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language":"ja,en;q=0.8","Accept":"text/html"})
    with urllib.request.urlopen(request,timeout=18) as response:
        if response.status!=200:raise ValueError("SportsNavi HTTP "+str(response.status))
        body=response.read(MAX_BYTES+1)
        if len(body)>MAX_BYTES:raise ValueError("SportsNavi HTML exceeds limit")
    return parse_page(body.decode("utf-8","replace"),race_id)
