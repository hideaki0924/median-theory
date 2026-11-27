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
try{u=new URL(source)}catch(e){throw Error('netkeibaのレースURLを貼り付けてください')}
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
const official=String(feed.official_datetime||'');
const date=official.match(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\+09:00)?$/);
if(!date)throw Error('オッズ取得時刻が不明');
const normalized=date[0].replace(' ','T').replace(/\+09:00$/,'');
const at=Date.parse(normalized+'+09:00');
if(!Number.isFinite(at))throw Error('取得時刻を読み取れません');
const age=(Date.now()-at)/60000;
if(!feed.race_start_at)throw Error('発走予定時刻の正式確認がありません。時刻の前後関係を検証できないため、実戦への反映を保留します');
const startMs=Date.parse(feed.race_start_at);
if(!Number.isFinite(startMs))throw Error('発走予定時刻の形式が不正');
if(at>=startMs)throw Error('原典オッズ時刻が発走予定以降。発走前の情報として利用不可');
if(Date.now()>=startMs)throw Error('対象レースは発走予定時刻を過ぎています。今から実戦分析へ混入させません');
if(age < 0 || age > 30)throw Error('取得時刻が古い／未来です（'+Math.round(age)+'分差）。発走前の最新オッズとは扱えません');
if(feed.status!=='available')throw Error('単複オッズの一部が未発売・未取得です');
return {at,official:normalized,age};
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
function invalidatePreviousLiveOdds(){
let cleared=false;
for(const id of ['v96Single','v95Odds']){
const input=$(id);
const name=input?.files?.[0]?.name||'';
if(name.startsWith('live-')){input.value='';cleared=true;}
}
if(cleared){
const status=$('v96Status');if(status)status.textContent='HOLD：以前取得した速報オッズは無効化しました。新しい全頭・発走前時刻の取得確認待ち。';
const result=$('v96Results');if(result)result.replaceChildren();
}
return cleared;
}
function clear(){
requestSerial++;go.disabled=false;invalidatePreviousLiveOdds();output.replaceChildren();message.textContent='レースのオッズをまだ取得していません。';
}
window.addEventListener('v86-upcoming-import',event=>{
const r=event.detail?.race;if(!r)return;
current=r;clear();
const auto=window.v111RaceId?.resolve(r);
if(auto){input.value='https://race.sp.netkeiba.com/race/shutuba.html?race_id='+auto+'&rf=live';message.textContent='レースID '+auto+' を開催表から自動設定。オッズ未取得なら安全にHOLDします。';}
else{input.value='';message.textContent='この開催日の正式レースIDはまだ登録されていません。netkeibaの出馬表URLを入力して取得できます。';}
});
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',()=>{current=null;clear();input.value='';});
go.addEventListener('click',async()=>{
const ticket=++requestSerial;go.disabled=true;output.replaceChildren();
const invalidated=invalidatePreviousLiveOdds();
if(invalidated){window.v96Market?.run();const b=$('v107Run');if(b&&!b.disabled)b.click();}
try{
const r=current,id=window.v111RaceId?.resolve(r)||raceId(input.value);
if(!r)throw Error('先に統合ファイルを選び、対象のレースを一括分析してください');
if(!matchesRace(id,r))throw Error('リンク先と選択レースが違います。URLの競馬場・レース番号を確認してください');
message.textContent='レースID '+id+' の公開オッズを確認中…';
const url='./odds-live/'+id+'.json?nocache='+Date.now();
const response=await fetch(url,{cache:'no-store'});
if(ticket!==requestSerial)return;
if(!response.ok)throw Error('GitHub側に単複オッズの公開データがまだ生成されていません（HTTP '+response.status+'）。取得処理の実行成功は未確認です');
const feed=await response.json();if(ticket!==requestSerial)return;
if(feed?.status==='unavailable')throw Error('netkeiba・スポーツナビとも取得できていません：'+String(feed.reason||'理由未確認').slice(0,160));
if(feed?.schema!=='NETKEIBA_LIVE_ODDS_V1'||feed.race_id!==id||feed.date!==r.date)throw Error('取得データのレース・開催日が一致しません');
if(!Array.isArray(feed.odds)||feed.odds.length!==r.horse_count||feed.horse_count!==r.horse_count)throw Error('単勝・複勝が全頭揃っていません：'+(feed.odds?.length||0)+'/'+r.horse_count);
const expected=new Map(r.horses.map(h=>[Number(h[0]),String(h[1]).normalize('NFKC').trim()])),seen=new Set();
for(const x of feed.odds){
const n=Number(x.horse_number),low=Number(x.place_lower),high=Number(x.place_upper);
if(!expected.has(n)||seen.has(n)||!(Number(x.win_odds)>=1)||!(low>=1)||!(high>=low))throw Error('馬番またはオッズ欠落・重複のため採用不可');
if(x.horse_name&&String(x.horse_name).normalize('NFKC').trim()!==expected.get(n))throw Error('馬番'+n+'の馬名が出走台帳と不一致。オッズを採用しません');
seen.add(n);
}
const t=txt('table','');const th=txt('tr','');
for(const name of ['馬番','単勝','複勝下限','複勝上限'])th.append(txt('th',name));t.append(th);
for(const x of feed.odds){const tr=txt('tr','');for(const v of [x.horse_number,x.win_odds,x.place_lower,x.place_upper])tr.append(txt('td',v));t.append(tr);}
output.append(t);
const source=feed.source==='sports_yahoo_co_jp'?'スポーツナビ':feed.source==='netkeiba_jra_odds_api'?'netkeiba':'公開オッズ';
if(feed.status!=='available'){
message.textContent='参考表示のみ：'+source+'、原典のオッズ時刻 '+(feed.official_datetime||'未確認')+'／状態 '+feed.status+'。発走後・古いオッズはメジアンや実戦予想へ反映しません。';
return;
}
let verified;
try{verified=validate(feed,id,r)}
catch(err){
message.textContent='参考表示のみ：'+source+'、原典のオッズ時刻 '+(feed.official_datetime||'未確認')+'。'+err.message+'。自動メジアンには反映していません。';
return;
}
createOddsFile(feed,r,verified.official);
if(window.v96Market)window.v96Market.run();else $('v96Run')?.click();
for(const target of ['v95Run','v107Run']){const b=$(target);if(b&&!b.disabled)b.click()}
message.textContent='取得成功：'+source+'の単勝・複勝'+feed.odds.length+'頭を照合。原典時刻 '+verified.official+'（'+Math.round(verified.age)+'分前）。メジアンとV107を更新。JRA公式確定値ではありません。';
}catch(error){if(ticket===requestSerial)fail(error.message)}finally{if(ticket===requestSerial)go.disabled=false}
});
})();