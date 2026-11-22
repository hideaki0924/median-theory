/* Single-file private data bundle importer. All file bytes remain in this browser. */
(()=>{'use strict';
const $=id=>document.getElementById(id),input=$('bundleFile'),venue=$('bundleVenue'),race=$('bundleRace'),go=$('bundleAnalyze'),status=$('bundleStatus');if(!input||!venue||!race||!go||!status)return;
let bundle=null;
const key=x=>[x.date,x.venue,String(x.race_no)].join('|');
const safe=x=>String(x??'').trim();
const accepted=['wood_csv','hill_csv','official_csv','twin_csv','wood_scout_csv','win_odds_csv','single_odds_csv','multi_odds_csv'];
const targets={wood_csv:['v91Wood'],hill_csv:['v91Hill'],official_csv:['v92Official'],twin_csv:['v92Twin'],wood_scout_csv:['v109Scout'],win_odds_csv:['v95Odds'],single_odds_csv:['v96Single'],multi_odds_csv:['v96Multi']};
const fileName={wood_csv:'wood.csv',hill_csv:'hill.csv',official_csv:'official.csv',twin_csv:'twin.csv',wood_scout_csv:'wood-scout-v010.csv',win_odds_csv:'win_odds.csv',single_odds_csv:'single_odds.csv',multi_odds_csv:'multi_odds.csv'};
const study=['v91Run','v92Run','v93Run','v94Run','v95Run','v96Run','v98Check','v102Run','v103Run','v104Run','v105Run','v106Run','v107Run'];
/* Private bundle is cached only in this browser (IndexedDB), never uploaded to GitHub. */
const CACHE_DB='horse-research-private-bundle-v1',CACHE_STORE='bundle',CACHE_KEY='latest';
function openCache(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(Error('このブラウザは端末保存に非対応'));const req=indexedDB.open(CACHE_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(CACHE_STORE))req.result.createObjectStore(CACHE_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('端末保存DBを開けません'));});}
async function cacheWrite(value){const db=await openCache();try{await new Promise((resolve,reject)=>{const tx=db.transaction(CACHE_STORE,'readwrite');tx.objectStore(CACHE_STORE).put(value,CACHE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('端末保存に失敗'));tx.onabort=()=>reject(tx.error||Error('端末保存中断'));});}finally{db.close();}}
async function cacheRead(){const db=await openCache();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(CACHE_STORE,'readonly');const req=tx.objectStore(CACHE_STORE).get(CACHE_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||Error('端末データ読込失敗'));});}finally{db.close();}}
async function cacheDelete(){const db=await openCache();try{await new Promise((resolve,reject)=>{const tx=db.transaction(CACHE_STORE,'readwrite');tx.objectStore(CACHE_STORE).delete(CACHE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('削除失敗'));});}finally{db.close();}}
function installBundle(value,origin){bundle=readBundle(value);clearSelect(venue);clearSelect(race);
const venues=[...new Set(bundle.races.map(x=>x.data.race.venue))];for(const v of venues)option(venue,v,v);
if(bundle.races.length){venue.value=bundle.races[0].data.race.venue;selection();race.value=bundle.races[0].data.race.date+'|'+bundle.races[0].data.race.race_no;}
go.disabled=false;
busy(origin+'：'+bundle.races.length+'レース。競馬場・Rを選んで分析できます。個人データはこの端末内だけで保持します。');
}
function clearSelect(select){select.replaceChildren();}
function option(select,value,label){const e=document.createElement('option');e.value=String(value);e.textContent=label;select.append(e);}
function busy(text){status.textContent=text;}
function validateRace(d){
if(d?.schema!=='TARGET_V86_UPCOMING_RACE_V1'||!d.race||!Array.isArray(d.past_fields)||!Array.isArray(d.race.horses))throw Error('TARGET台帳の形式が不正');
const r=d.race;
if(!/^\d{4}-\d{2}-\d{2}$/.test(safe(r.date))||!safe(r.venue)||!Number.isInteger(Number(r.race_no))||Number(r.race_no)<1||Number(r.race_no)>12)throw Error('レースの開催日・場・Rが不正');
if(r.horse_count!==r.horses.length||r.horses.length<2||r.horses.length>28)throw Error('出走頭数が不正');
const need=['date','race_id','finish_position','distance_m','source_status'];
if(need.some(f=>!d.past_fields.includes(f)))throw Error('過去走の必須列が不足');
const idx=new Map(d.past_fields.map((f,i)=>[f,i]));const ids=new Set(),numbers=new Set();
for(const h of r.horses){
if(!Array.isArray(h)||!Number.isInteger(Number(h[0]))||!safe(h[1])||!safe(h[2])||ids.has(safe(h[2]))||numbers.has(Number(h[0]))||!Array.isArray(h[8])||h[8].length>10)throw Error('馬番・馬名・ID・直近10走に異常');
ids.add(safe(h[2]));numbers.add(Number(h[0]));const seen=new Set();
for(const past of h[8]){if(!Array.isArray(past)||past.length!==d.past_fields.length)throw Error('過去走の列数異常：'+h[1]);const dt=safe(past[idx.get('date')]),rid=safe(past[idx.get('race_id')]);if(!/^\d{4}-\d{2}-\d{2}$/.test(dt)||dt>=r.date||!rid||seen.has(rid)||past[idx.get('source_status')]!=='STRICT_ID_MATCH')throw Error('過去走の日時・ID・重複異常：'+h[1]);seen.add(rid);}
}
return d;
}
function selection(){if(!bundle)return;clearSelect(race);const selected=bundle.races.filter(x=>x.data.race.venue===venue.value);for(const item of selected)option(race,item.data.race.date+'|'+item.data.race.race_no,item.data.race.date+' '+item.data.race.race_no+'R '+(item.data.race.race_name||item.data.race.class_name||''));if(selected.length)renderFacts(selected[0]);}
function readBundle(value){
if(value?.schema!=='HORSE_RESEARCH_BUNDLE_V1'||!Array.isArray(value.races)||!value.races.length)throw Error('統合データの形式が違います。HORSE_RESEARCH_BUNDLE_V1が必要です');
const used=new Set();
for(const item of value.races){if(!item||!item.data)throw Error('レースのTARGET台帳がありません');validateRace(item.data);const k=key(item.data.race);if(used.has(k))throw Error('同一レースが重複しています：'+k);used.add(k);
for(const f of accepted)if(item[f]!=null&&typeof item[f]!=='string')throw Error(f+' はCSV文字列として統合してください');
}return value;
}
input.addEventListener('change',async()=>{
go.disabled=true;bundle=null;clearSelect(venue);clearSelect(race);
try{
const file=input.files?.[0];if(!file)throw Error('統合データファイルを選択してください');
if(file.size>16e6)throw Error('ファイルが16MBを超えています。分割が必要です');
busy('統合データを端末内で読み込んでいます…');
const json=JSON.parse(await file.text());
installBundle(json,'統合データ読込完了');
try{await cacheWrite(json);busy('保存完了：次回からこの端末の同じブラウザで自動復元します。'+bundle.races.length+'レース。');}
catch(e){busy('分析用データは読込済み。ただし自動保存できません：'+e.message+'。次回は再選択が必要です。');}
}catch(e){busy('HOLD：'+e.message)}
});
/* Reopen existing private data automatically on the same device, without a server fetch. */
(async()=>{if(input.files?.length||bundle)return;
try{const value=await cacheRead();if(!value||input.files?.length||bundle)return;installBundle(value,'端末保存データを自動復元');}
catch(e){busy('端末保存データを復元できません：'+e.message+'。統合JSONを選択してください。');}
})();
const clearButton=document.createElement('button');clearButton.type='button';clearButton.id='bundleForget';clearButton.textContent='この端末の保存データを消去';clearButton.style.background='#33465c';clearButton.style.color='#edf5ff';clearButton.style.fontSize='13px';
clearButton.addEventListener('click',async()=>{if(!window.confirm('この端末に保存した統合データを消去しますか？ 公開GitHub上のデータには影響しません。'))return;try{await cacheDelete();bundle=null;go.disabled=true;input.value='';clearSelect(venue);clearSelect(race);busy('端末保存データを消去しました。次回利用時は統合JSONを読み込んでください。');}catch(e){busy('削除できません：'+e.message)}});
status.parentElement.append(clearButton);

/* Compact, mobile-first view. All validated source data and old studies remain untouched. */
const dashboard=document.createElement('section');dashboard.id='researchDashboard';dashboard.hidden=true;
$('singleBundle').insertAdjacentElement('afterend',dashboard);
const dashStyle=document.createElement('style');dashStyle.textContent="#researchDashboard{margin:12px 0;color:#edf5ff}#researchDashboard .head{background:#153a4d;padding:14px;border-radius:13px;border:1px solid #477789}#researchDashboard h2{font-size:21px;margin:0}#researchDashboard .desc{font-size:13px;color:#c4d9e8;margin:4px 0}#researchDashboard .stats,#researchDashboard .filters{display:flex;flex-wrap:wrap;gap:7px;margin:11px 0}#researchDashboard .stats span{background:#254559;padding:7px 9px;border-radius:7px;font-size:13px}#researchDashboard .filters button{margin:0;background:#253d55;color:#dceefa;font-size:13px;padding:9px;border:1px solid #59738a}#researchDashboard .filters button[aria-pressed=true]{background:#38c8a7;color:#09251f}#researchDashboard .horses{display:grid;grid-template-columns:1fr;gap:8px}#researchDashboard details{background:#182d42;border:1px solid #4c6980;border-radius:12px;overflow:hidden}#researchDashboard details[open]{border-color:#38c8a7}#researchDashboard summary{padding:13px;display:flex;gap:10px;align-items:center;cursor:pointer;list-style:none;color:white}#researchDashboard summary::-webkit-details-marker{display:none}#researchDashboard .num{width:34px;height:34px;flex:0 0 34px;background:#31516c;display:grid;place-items:center;border-radius:8px;font-size:17px;font-weight:900}#researchDashboard .name{font-size:16px;font-weight:800;overflow-wrap:anywhere}#researchDashboard .badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}#researchDashboard .badge{font-size:11px;padding:2px 6px;border-radius:5px;background:#2d485f;color:#e0edf6}#researchDashboard .gold{background:#554b26;color:#ffde88}#researchDashboard .body{padding:0 13px 13px;font-size:13px}#researchDashboard .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0}#researchDashboard .cell{background:#102438;border-radius:6px;padding:8px}#researchDashboard small{display:block;color:#adc3d7}#researchDashboard strong{font-size:15px}#researchDashboard h4{font-size:14px;color:#94e7d5;margin:13px 0 5px}#researchDashboard .detail{white-space:pre-line;overflow-wrap:anywhere;font-size:13px}#researchDashboard .scroller{overflow-x:auto;-webkit-overflow-scrolling:touch}#researchDashboard table{min-width:490px;width:100%;font-size:12px}#researchDashboard td,#researchDashboard th{padding:6px 5px;white-space:nowrap}#researchDashboard .caution{background:#493a2d;color:#ffe1aa;border-radius:7px;padding:8px;font-size:12px}#researchDashboard .foot{font-size:12px;color:#b6cbd8;margin:12px 0}body:not(.showLegacy) main>section.card:not(#singleBundle){display:none!important}@media(min-width:800px){#researchDashboard .horses{grid-template-columns:repeat(2,minmax(0,1fr))}}";document.head.append(dashStyle);
function node(tag,cls,val){const n=document.createElement(tag);if(cls)n.className=cls;if(val!==undefined)n.textContent=String(val);return n}
function shown(x){return x===null||x===undefined||x===''?'—':String(x)}
function renderFacts(item){
const r=item.data.race,hs=r.horses,ix=Object.fromEntries(item.data.past_fields.map((f,i)=>[f,i]));
dashboard.replaceChildren();
const head=node('div','head');head.append(node('h2','',r.venue+' '+r.race_no+'R｜全頭研究'),node('p','desc',(r.race_name||r.class_name||'')+' '+(r.surface||'')+(r.distance_m||'')+'m　発走前SOURCE'));
const stats=node('div','stats');
const goldN=hs.filter(h=>h[9]?.v38_golden_wood_scout_v010?.any_golden_v010).length;
const twinN=hs.filter(h=>h[9]?.v37_twin_origin_v010?.best_origin?.top5_uploaded_day_research).length;
for(const v of ['全'+hs.length+'頭','黄金 '+goldN+'頭','双子原点 '+twinN+'頭','過去'+hs.reduce((n,h)=>n+(h[8]?.length||0),0)+'走'])stats.append(node('span','',v));
head.append(stats);dashboard.append(head);
const control=node('div','filters'),list=node('div','horses');let filter='all';
const rows=hs.slice().sort((a,b)=>Number(a[0])-Number(b[0])).map(h=>{
const meta=h[9]||{},f=meta.v35_factual_feature_card||{},p=meta.v36_pre_race_position_fatigue_audit||{},t=meta.v37_twin_origin_v010||{},g=meta.v38_golden_wood_scout_v010||{},a=meta.v39_gold_ability_crosscheck||{};
const gold=!!g.any_golden_v010,twin=!!t.best_origin?.top5_uploaded_day_research,form=Number(a.last5_top3_n)>=2;
const types=Object.keys(g.types||{}).filter(k=>g.types[k]);
const card=node('details',''),title=node('summary',''),number=node('span','num',h[0]),label=node('div','');
label.append(node('div','name',h[1]));const tags=node('div','badges');
if(gold)tags.append(node('span','badge gold','黄金'+(types.length?' '+types.length+'型':'')));
if(twin)tags.append(node('span','badge','◇ 双子原点'));
if(form)tags.append(node('span','badge','近5走好走'));
tags.append(node('span','badge','過去'+(h[8]?.length||0)+'走'));label.append(tags);
title.append(number,label);card.append(title);
const body=node('div','body'),grid=node('div','grid');
for(const [k,v] of [['3着以内',shown(f['直近7走3着以内回数'])+'回'],['同距離',shown(f['同距離走数'])+'走'],['前走',shown(f['前走着順'])+'着'],['0.8秒内',shown(f['直近7走着差0.8秒以内回数'])+'回'],['同距離3着内',shown(a.same_distance_surface_top3_7)],['同級0.5秒内',shown(a.same_class_surface_within_half_sec_7)]]){const x=node('div','cell');x.append(node('small','',k),node('strong','',v));grid.append(x)}
body.append(grid,node('h4','','調教・展開・疲労'));
const record='黄金：'+(gold?types.join('＋'):'該当なし／未確認')+'\n双子原点：'+(t.best_origin?.origin_mean_D!=null?'D='+Number(t.best_origin.origin_mean_D).toFixed(3):'未取得')+'\n位置取り：'+shown(p.position_category||p.position_profile||p.position_bucket)+'　休み：'+shown(p.days_since_previous_run??p.rest_days)+'日\n調教照合：'+shown(meta.training_status);
body.append(node('p','detail',record));
if(a.positive_evidence?.length)body.append(node('p','detail','好材料：'+a.positive_evidence.join('、')));
if(a.cautions?.length)body.append(node('p','caution','注意：'+a.cautions.join('、')));
body.append(node('h4','','過去7走（横スクロール）'));
if(!(h[8]||[]).length)body.append(node('p','detail','過去走なし／未出走'));
else{const wrap=node('div','scroller'),tbl=node('table',''),tr=node('tr','');
for(const v of ['日付','距離','着順','時計','4角','上がり'])tr.append(node('th','',v));tbl.append(tr);
for(const past of h[8]){const line=node('tr','');
for(const v of [past[ix.date],shown(past[ix.surface])+shown(past[ix.distance_m]),past[ix.finish_position],past[ix.finish_time_seconds],past[ix.corner_4],past[ix.last3f_seconds]])line.append(node('td','',shown(v)));tbl.append(line)}wrap.append(tbl);body.append(wrap)}
card.append(body);return{card,gold,twin,form,unknown:!(h[8]?.length)}
});
const draw=()=>{list.replaceChildren();const selected=rows.filter(v=>filter==='all'||v[filter]);for(const v of selected)list.append(v.card);if(!selected.length)list.append(node('p','detail','該当馬なし'))};
for(const [id,label] of [['all','全頭'],['gold','🟡黄金'],['twin','◇双子'],['form','近走好走'],['unknown','過去走なし']]){const btn=node('button','',label);btn.type='button';btn.setAttribute('aria-pressed',String(id===filter));btn.addEventListener('click',()=>{filter=id;for(const b of control.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===btn));draw()});control.append(btn)}
dashboard.append(control,list,node('p','foot','まず全頭を一覧比較。馬名を押すと過去走・能力・調教・注意点を表示します。研究式は変更していません。勝率と買い目はこの一覧から自動決定しません。'));
dashboard.hidden=false;draw();
}
venue.addEventListener('change',selection);
race.addEventListener('change',()=>{const item=bundle?.races.find(x=>x.data.race.venue===venue.value&&x.data.race.date+'|'+x.data.race.race_no===race.value);if(item)renderFacts(item);});
go.addEventListener('click',()=>{
if(!bundle)return busy('HOLD：統合データ未選択');
go.disabled=true;
try{
const item=bundle.races.find(x=>x.data.race.venue===venue.value&&x.data.race.date+'|'+x.data.race.race_no===race.value);
if(!item)throw Error('対象レースが統合データにありません');
const d=validateRace(item.data),r=d.race;
for(const [field,value] of [['v90Date',r.date],['v90Venue',r.venue],['v90Race',String(r.race_no)],['v88Date',r.date],['v88Venue',r.venue],['v88RaceNo',String(r.race_no)],['v88Surface',r.surface],['v88Distance',String(r.distance_m)],['v88Class',r.class_name||r.race_name||'未設定'],['v88Lineup',r.horses.map(h=>h[0]+','+h[1]).join('\n')]]){const x=$(field);if(x)x.value=value;}
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.dispatchEvent(new Event('change',{bubbles:true}));
const missing=[];
for(const name of accepted){const content=item[name];for(const id of targets[name]){const target=$(id);if(!target)continue;if(typeof content==='string'&&content.trim()){const dt=new DataTransfer();dt.items.add(new File([content],fileName[name],{type:'text/csv'}));target.files=dt.files;}else{target.value='';missing.push(name);}}}
window.dispatchEvent(new CustomEvent('v86-upcoming-import',{detail:d}));
renderFacts(item);
for(const id of study){const b=$(id);if(b&&!b.disabled)b.click()}
// Public odds refresh is separate and asynchronous; it never uploads bundle data.
// Only attempt when verified race-ID mapping exists; URL input remains fallback.
if(window.v111RaceId?.resolve(r))$('liveOddsRefresh')?.click();
busy(r.date+' '+r.venue+r.race_no+'R／'+r.horse_count+'頭の研究監査を起動しました。不足SOURCE：'+([...new Set(missing)].join('、')||'なし')+'。分析結果を下のV107・V103で確認。直前情報・勝率・期待値が未検証なら馬券HOLD。');
$('v107Cross')?.scrollIntoView({behavior:'smooth'});
}catch(e){busy('HOLD：'+e.message)}finally{go.disabled=false}
});
})();