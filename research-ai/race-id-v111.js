/* Verified public JRA race IDs for 2026-11-21; no guessed kaiji/day for other dates.
   Venue/Race derived from users' private race selection, without uploading data. */
(()=>{'use strict';
const mapping=Object.freeze({
 "2026-11-21|京都":"2026080505",
 "2026-11-21|福島":"2026030305",
 "2026-11-22|京都":"2026080506",
 "2026-11-22|東京":"2026050505",
 "2026-11-23|福島":"2026030306"
});
function resolve(race){
if(!race)return null;
const prefix=mapping[String(race.date)+'|'+String(race.venue)];
const n=Number(race.race_no);
if(!prefix||!Number.isInteger(n)||n<1||n>12)return null;
return prefix+String(n).padStart(2,'0');
}
window.v111RaceId={resolve,mapping};
})();