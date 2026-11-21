/* Live public odds: same-origin GitHub Pages snapshot, never predicted odds.
   netkeiba link only identifies the race. Background GitHub Action reads public API.
*/
(()=>{'use strict';
const $=id=>document.getElementById(id),box=$('liveOdds'),input=$('liveOddsUrl'),go=$('liveOddsRefresh'),message=$('liveOddsStatus'),output=$('liveOddsRows');
if(!box||!input||!go||!message||!output)return;
let current=null,requestSerial=0;
const venueCodes={'01':'札幌','02':'函館','03':'福島','04':'新潟','05':'東京','06':'中山','07':'中京','08':'京都','09':'阪神','10':'小倉'};
const nameKey=x=>String(x??'').normalize('NFKC').trim();
const txt=(tag,value)=>{const e=document.createElement(tag);e.textContent=String(value??'');return e;};
const fail=msg=>{message.textContent='HOLD：'+msg;};
function raceId(source){
let u;
try{u=new URL(source)}catch(e){throw Error('netkeibaの出馬表URLを貼り付けてください')}
if(!['race.netkeiba.com','race.sp.netkeiba.com'].includes(u.hostname)||u.protocol!=='https:')throw Error('netkeibaのHTTPSリンクだけを受け付けます');
const id=u.searchParams.get('race_id');
if(!/^20\d{10}$/.test(id||'')||!venueCodes[id.slice(4,6)])throw Error('12桁のJRAレースIDをURLから取得できません');
return id;
}
function matchesRace(id,race){
return race&&venueCodes[id.slice(4,6)]===nameKey(race.venue)&&Number(id.slice(10,12))===Number(race.race_no)&&id.slice(0,4)===String(race.date).slice(0,4);
}
function validate(feed,id,race){
if(!feed||feed.schema!=='NETKEIBA_LIVE_ODDS_V1'||feed.race_id!==id||feed.date!==race.date||!matchesRace(id,race))throw Error('レースID・開催日が統合台帳と一致しません');
if(!Array.isArray(feed.odds)||feed.odds.length!==race.horse_count||feed.horse_count!==race.horse_count)throw Error('オッズが全頭そろっていません（'+(feed.odds?.length||0)+'/'+race.horse_count+'頭）');
const numbers=new Set(race.horses.map(h=>Number(h[0]))),seen=new Set();
for(const x of feed.odds){if(!Number.isInteger(x.horse_number)||!numbers.has(x.horse_number)||seen.has(x.horse_number)||!(Number(x.win_odds)>=1)||!(Number(x.place_upper)>=1)||Number(x.place_upper)<Number(x.place_lower)||!Number.isFinite(Number(x.place_upper)))throw Error('馬番・単複上限が不正または欠落');seen.add(x.horse_number);}
const official=feed.official_datetime||feed.fetched_at||'';
const date=official.match(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d/);
if(!date)throw Error('オッズ取得時刻が不明');
const at=new Date(date[0].replace(' ','T')+'+09:00').getTime();
if(!Number.isFinite(at))throw Error('取得時刻を読み取れません');
const age=(Date.now()-at)/60000;
if(age < -10 || age > 30)throw Error('取得時刻が古い／未来です（'+Math.round(age)+'分差）。発走前の最新オッズとは扱えません');
if(feed.status!=='available')throw Error('単複オッズの一部が未発売・未取得です');
return {at,official:date[0],age};
}
function createOddsFile(feed,race,official){
const lines=['date,venue,race_no,horse_number,win_odds,place_upper,captured_at'];
const winLines=['date,venue,race_no,horse_number,win_odds,captured_at'];
for(const x of feed.odds){
const base=[race.date,race.venue,race.race_no,x.horse_number,x.win_odds];
lines.push([...base,x.place_upper,official].join(','));
winLines.push([...base,official].join(','));
}
function assign(id,name,content){
const destination=$(id);if(!destination)throw Error('内部入力欄が見つかりません：'+id);
const dt=new DataTransfer();dt.items.add(new File([content],name,{type:'text/csv'}));destination.files=dt.files;
}
assign('v96Single','live-single-place.csv',lines.join('\n'));
assign('v95Odds','live-win.csv',winLines.join('\n'));
}
function clear(){
requestSerial++;output.replaceChildren();message.textContent='レースのオッズをまだ取得していません。'; // input is preserved for re-checking, but checked per race.
}
window.addEventListener('v86-upcoming-import',event=>{
const r=event.detail?.race;if(!r)return;
current=r;clear();
if(r.date==='2026-11-21'&&r.venue==='京都'&&Number(r.race_no)===5){
input.value='https://race.sp.netkeiba.com/race/shutuba.html?race_id=202608050505&rf=live';
}
});
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',()=>{current=null;clear()});
go.addEventListener('click',async()=>{
const ticket=++requestSerial;go.disabled=true;output.replaceChildren();
try{
const id=raceId(input.value),r=current;
if(!r)throw Error('先に統合ファイルを選び、対象のレースを一括分析してください');
if(!matchesRace(id,r))throw Error('リンク先と選択レースが違います。URLの競馬場・レース番号を確認してください');
message.textContent='netkeibaレースID '+id+' の公開オッズを確認中…';
const url='./odds-live/'+id+'.json?nocache='+Date.now();
const response=await fetch(url,{cache:'no-store'});
if(ticket!==requestSerial)return;
if(!response.ok)throw Error('オッズ自動取得の公開データがありません（HTTP '+response.status+'）。GitHub側の取得は未成功です');
const feed=await response.json();if(ticket!==requestSerial)return;
const verified=validate(feed,id,r);
createOddsFile(feed,r,verified.official);
const t=txt('table','');const th=txt('tr','');
for(const name of ['馬番','単勝','複勝下限','複勝上限'])th.append(txt('th',name));t.append(th);
for(const x of feed.odds){const tr=txt('tr','');for(const v of [x.horse_number,x.win_odds,x.place_lower,x.place_upper])tr.append(txt('td',v));t.append(tr);}
output.append(t);
for(const target of ['v95Run','v96Run','v107Run']){const b=$(target);if(b&&!b.disabled)b.click()}
message.textContent='実オッズ '+feed.odds.length+'頭を統合。取得時刻 '+verified.official+'（'+Math.round(verified.age)+'分前）。単複メジアン・V107を再実行しました。結果と発走時刻は最終確認してください。';
}catch(error){if(ticket===requestSerial)fail(error.message)}finally{if(ticket===requestSerial)go.disabled=false}
});
})();