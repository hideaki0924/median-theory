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
const settings=$('bundleSettings');if(settings)settings.open=false;
busy(origin+'：'+bundle.races.length+'レースを読み込みました。');
go.click();

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
go.disabled=true;bundle=null;clearSelect(venue);clearSelect(race);clearVisibleRace();
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
clearButton.addEventListener('click',async()=>{if(!window.confirm('この端末に保存した統合データを消去しますか？ 公開GitHub上のデータには影響しません。'))return;try{await cacheDelete();bundle=null;go.disabled=true;input.value='';clearSelect(venue);clearSelect(race);clearVisibleRace();busy('端末保存データを消去しました。次回利用時は統合JSONを読み込んでください。');}catch(e){busy('削除できません：'+e.message)}});
$('bundleSettings')?.querySelector('.bundle-settings-inside')?.append(clearButton);
const advanced=$('legacyToggleWrap');if(advanced)$('bundleSettings')?.querySelector('.bundle-settings-inside')?.append(advanced);


/* Mobile race table V40 — presentation only; all historical research and calculation modules retained. */
const dashboard=document.createElement('section');dashboard.id='researchDashboard';dashboard.hidden=true;
$('singleBundle').insertAdjacentElement('afterend',dashboard);
let marketSummary=null,crossSummary=null,marketRedraw=null,preferredMode='総合';
window.addEventListener('v107-cross-summary',e=>{crossSummary=e.detail;marketRedraw?.();});
window.addEventListener('v96-market-summary',e=>{marketSummary=e.detail;marketRedraw?.();});
function clearVisibleRace(){crossSummary=null;marketSummary=null;marketRedraw=null;dashboard.replaceChildren();dashboard.hidden=true;for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.dispatchEvent(new Event('change',{bubbles:true}));}
const marketPanel=document.createElement('div');marketPanel.id='compactMarketStatus';marketPanel.style.cssText='font-size:12px;padding:9px;margin:7px 0;border:1px solid #456879;border-radius:8px;background:#122d40;overflow-wrap:anywhere';
const marketText=document.createElement('div');marketText.setAttribute('aria-live','polite');marketPanel.append(marketText);
const marketRefresh=document.createElement('button');marketRefresh.type='button';marketRefresh.textContent='単複オッズ更新';marketRefresh.style.cssText='font-size:12px;padding:7px;margin:5px 0 0';marketRefresh.addEventListener('click',()=>{if(bundle)$('liveOddsRefresh')?.click()});marketPanel.append(marketRefresh);
const syncMarket=()=>{marketText.textContent='市場｜'+($('liveOddsStatus')?.textContent||'未取得');marketRefresh.disabled=!!$('liveOddsRefresh')?.disabled;};
const liveMessage=$('liveOddsStatus');if(liveMessage&&typeof MutationObserver!=='undefined'){new MutationObserver(syncMarket).observe(liveMessage,{childList:true,characterData:true,subtree:true});const liveButton=$('liveOddsRefresh');if(liveButton)new MutationObserver(syncMarket).observe(liveButton,{attributes:true,attributeFilter:['disabled']});}
const intro=$('singleBundle');if(intro){const h=intro.querySelector('h1');if(h)h.textContent='競馬研究AI｜全頭比較表';const x=intro.querySelector('p strong');if(x)x.textContent='競馬場とRを選ぶと、全頭を表で比較できます。行をタップすると詳細を表示。';}
const legacy=$('legacyToggle');if(legacy){legacy.textContent='その他の詳細研究・オッズを表示';legacy.style.cssText='font-size:13px;background:#263f54;color:#c6dfeb;border:1px solid #587189;padding:9px;margin:0 0 8px';}
const viewStyle=document.createElement('style');viewStyle.textContent="\n#researchDashboard{margin:12px 0 16px;color:#eef7ff;max-width:100%}\n#researchDashboard .rt-header{padding:11px 12px;background:#17374c;border:1px solid #42697c;border-radius:12px;margin-bottom:9px}\n#researchDashboard h2{font-size:19px;margin:0;color:#fff}#researchDashboard .rt-sub{font-size:12px;color:#c3d8e7;margin:4px 0 0}\n#researchDashboard .rt-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:9px 0}\n#researchDashboard .rt-tabs button{margin:0;padding:10px 0;font-size:14px;background:#213d53;color:#d6e6f2;border:1px solid #496980;border-radius:8px}\n#researchDashboard .rt-tabs button[aria-pressed=true]{background:#38c8a7;color:#07231d;border-color:#38c8a7}\n#researchDashboard .rt-count{font-size:12px;color:#c2d8e3;margin:5px 0 9px}\n#researchDashboard .rt-scroll{border:1px solid #506f83;border-radius:10px;overflow-x:auto;max-width:100%;background:#13273a;-webkit-overflow-scrolling:touch}\n#researchDashboard .rt-table{border-collapse:separate;border-spacing:0;width:100%;min-width:0;font-size:12px;table-layout:fixed}\n#researchDashboard .rt-table th{background:#24445a;color:#b2eddf;font-size:12px;padding:10px 4px;white-space:nowrap;border-bottom:1px solid #587a8b;text-align:center}\n#researchDashboard .rt-table td{border-bottom:1px solid #355168;padding:10px 4px;vertical-align:middle;text-align:center;overflow-wrap:anywhere;line-height:1.4}\n#researchDashboard .rt-table tbody tr.rt-row{cursor:pointer}\n#researchDashboard .rt-table tbody tr.rt-row:active{background:#31556b}\n#researchDashboard .rt-table td.rt-horse{text-align:left;font-weight:700;color:#f6fbff;font-size:13px}\n#researchDashboard .rt-table td.rt-num{font-size:14px;font-weight:900}\n#researchDashboard .rt-table .rt-empty{color:#879dae}\n#researchDashboard .rt-table .rt-tag{display:inline-block;border-radius:5px;background:#2f4c62;color:#e7f4ff;font-size:11px;padding:2px 4px;line-height:1.4}\n#researchDashboard .rt-table .rt-gold{background:#655023;color:#ffe49f}\n#researchDashboard .rt-table .rt-twin{background:#245260;color:#9ceff1}\n#researchDashboard .rt-table tr.rt-detailrow td{text-align:left;background:#0e2030;padding:12px 10px;border-bottom:2px solid #38c8a7}\n#researchDashboard .rt-detailrow .rt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}\n#researchDashboard .rt-detailrow .rt-box{background:#1d3447;border-radius:6px;padding:7px;min-width:0}\n#researchDashboard .rt-detailrow small{display:block;color:#acc7d9}\n#researchDashboard .rt-detailrow strong{font-size:14px}\n#researchDashboard .rt-detailrow h4{color:#8fe3d7;margin:12px 0 5px;font-size:14px}\n#researchDashboard .rt-detailrow .rt-note{font-size:12px;white-space:pre-line;overflow-wrap:anywhere}\n#researchDashboard .rt-past{max-width:100%;overflow-x:auto}\n#researchDashboard .rt-past table{min-width:500px;width:100%;font-size:12px}\n#researchDashboard .rt-past th,#researchDashboard .rt-past td{padding:6px 4px;white-space:nowrap}\n#researchDashboard .rt-foot{font-size:12px;color:#a8c2d5;margin-top:9px}\n@media(max-width:400px){#researchDashboard .rt-table th,#researchDashboard .rt-table td{padding-left:3px;padding-right:3px}#researchDashboard .rt-table td.rt-horse{font-size:12px}}\n";viewStyle.textContent+="\n#researchDashboard .rt-fold{margin:9px 0;padding:9px;border:1px solid #456879;border-radius:8px;background:#152e40;font-size:12px}#researchDashboard .rt-fold summary{cursor:pointer;padding:3px;color:#cbe8f2}#researchDashboard .rt-research-select{width:100%;padding:8px;margin:0 0 5px;border-radius:8px;font-size:14px;background:#203c51;color:#fff;border:1px solid #496980;box-sizing:border-box}#researchDashboard .rt-brief{display:flex;flex-direction:column;gap:3px;background:#193445;border:1px solid #456879;border-radius:8px;padding:7px 9px;font-size:12px}#researchDashboard .rt-tabs{margin:7px 0 5px}#researchDashboard .rt-table .rt-tag{display:block;margin:2px 0}#researchDashboard .rt-foot{font-size:11px;line-height:1.4}";
document.head.append(viewStyle);
function cell(tag,text,cls){const v=document.createElement(tag);v.textContent=text==null||text===''?'—':String(text);if(cls)v.className=cls;return v;}
const valid=x=>x!==null&&x!==undefined&&x!==''&&x!=='—';
const fmt=x=>valid(x)?String(x):'—';
function renderFacts(item){
const r=item.data.race,hh=r.horses.slice().sort((a,b)=>Number(a[0])-Number(b[0]));
const ix=Object.fromEntries(item.data.past_fields.map((f,i)=>[f,i]));
dashboard.replaceChildren();
const absentFeatures=r.horses.some(h=>!h[9]?.v35_factual_feature_card);const auditNotes=document.createElement('details');auditNotes.className='rt-fold';auditNotes.append(cell('summary','資料の収録状況・研究監査（必要時に開く）'));
if(absentFeatures){
 const warning=document.createElement('div');warning.setAttribute('role','alert');warning.style.cssText='background:#4a321d;border:2px solid #f1bd61;color:#fff0cf;padding:12px;border-radius:10px;margin-bottom:10px;font-size:15px;line-height:1.45';
 warning.textContent='⚠️ 保存済み一部因子が未収録です。見直しタブは既存研究で走歴を再計算します。未取得データは補完しません。';
 auditNotes.append(warning);
}

const header=document.createElement('div');header.className='rt-header';
header.append(cell('h2',r.venue+' '+r.race_no+'R｜全'+hh.length+'頭'));
header.append(cell('p',(r.race_name||r.class_name||'')+'　'+(r.surface||'')+(r.distance_m||'')+'m','rt-sub'));
dashboard.append(header);syncMarket();
const overview=document.createElement('div');overview.style.cssText='background:#182f42;border:1px solid #4c697d;border-radius:9px;padding:9px;margin:7px 0;font-size:12px';const marketFold=document.createElement('details');marketFold.className='rt-fold';marketFold.append(cell('summary','オッズ取得・1番人気・荒れ監査の詳細'),marketPanel,overview);
const currentKey=[r.date,r.venue,String(r.race_no)].join('|');
const currentMarket=()=>marketSummary?.key===currentKey?marketSummary:null;
const currentCross=h=>crossSummary?.key===currentKey?crossSummary.rows.find(x=>x.no===Number(h[0])):null;
function fact(module,h){try{if(!module?.evaluate)return {error:'研究モジュール未接続'};return {data:module.evaluate(h,item.data.past_fields,r)};}catch(e){return {error:e.message};}}
function marketOverview(){overview.replaceChildren();const m=currentMarket(),a=m?.single;overview.append(cell('strong','荒れ・堅さ｜判定HOLD'));overview.append(cell('div',a?'単勝上位3頭の逆数集中度 '+a.top3.toFixed(1)+'%｜赤 '+a.red+'頭｜3〜5倍 '+a.cluster+'頭':'単複オッズ未取得・未照合'));if(a){const overlap=a.rows.filter(x=>x.cross).map(x=>x.no+'番');overview.append(cell('div','単勝1人気 '+a.favorite.no+'番 '+a.favorite.odds.toFixed(1)+'倍｜複勝上限1位 '+a.placeFavorite+'番｜'+(a.soloFavorite?'単独1倍台':'単独1倍台なし')));overview.append(cell('div','単勝×複勝上限メジアン重複：'+(overlap.join('・')||'なし')));overview.append(cell('div','入力時刻 '+a.time+'（参考値・発走前採用可否は市場ステータス参照）'));}const gate=m?.favoriteGate;if(gate){const g=document.createElement('details');g.open=true;g.append(cell('summary','1番人気監査｜'+(gate.gates.filter(x=>x.match===true).map(x=>x.name).join('・')||'該当なし／保留')));g.append(cell('div',gate.favorite?'単勝 '+gate.favorite+'番 '+gate.odds.toFixed(1)+'倍｜2人気比 '+gate.ratio.toFixed(2)+'｜タテ目 '+(gate.tate===null?'未確認':gate.tate.toFixed(2))+'（'+gate.tateStatus+'）':gate.status));const gt=document.createElement('table'),gh=document.createElement('tr');for(const h of ['ゲート','状態','過去R','1着','2–3着','圏外'])gh.append(cell('th',h));gt.append(gh);for(const x of gate.gates){const tr=document.createElement('tr');for(const v of [x.name,x.match===null?'保留':x.match?'該当':'非該当',x.match===true?x.stats[0]:'—',...x.stats.slice(1).map(n=>x.match===true?n.toFixed(1)+'%':'—')])tr.append(cell('td',v));gt.append(tr);}g.append(gt,cell('div','市場3450R 本線飛び司令塔 V0.10：各ゲートは重複あり。過去の実測頻度であり、今回の確率ではない。実戦採用は発走前オッズ・全頭監査を確認するまでHOLD。'));overview.append(g);}else overview.append(cell('div','1番人気監査：単複未照合'));const detail=document.createElement('details');detail.append(cell('summary','7券種の組合せ監査・集中度 '+(m?.multi?.filter(x=>x.complete).length||0)+'/7'));const t=document.createElement('table');const head=document.createElement('tr');for(const x of ['券種','件数','上位3組'])head.append(cell('th',x));t.append(head);for(const kind of ['単勝','複勝','馬連','馬単','ワイド','三連複','三連単']){const x=m?.multi?.find(v=>v.kind===kind),tr=document.createElement('tr');for(const value of [kind,x?x.count+'/'+x.expected:'未入力',x?.complete?x.concentration:'HOLD'])tr.append(cell('td',value));t.append(tr);}detail.append(t,cell('p','全組合せ・重複・券種内時刻を監査。発売条件やレンジの定義は別途確認。荒れ判定の検証済み閾値なし。複勝下限メジアンは未接続。'));overview.append(detail);}
let mode=preferredMode,openHorse=null;
const tabs=document.createElement('nav');tabs.className='rt-tabs';tabs.setAttribute('aria-label','表示項目を切り替える');
const modes=['総合','能力','調教','展開','市場','見直し','独自研究','調教候補','安井式'];tabs.style.gridTemplateColumns='repeat(4,minmax(0,1fr))';
const btns=[];
const status=document.createElement('div');status.className='rt-count';
const scroll=document.createElement('div');scroll.className='rt-scroll';
const table=document.createElement('table');table.className='rt-table';scroll.append(table);
const summary=(h)=>{
const m=h[9]||{},a=m.v35_factual_feature_card||{},b=m.v36_pre_race_position_fatigue_audit||{},g=m.v38_golden_wood_scout_v010||{},t=m.v37_twin_origin_v010||{},c=m.v39_gold_ability_crosscheck||{};
const gold=Object.keys(g.types||{}).filter(k=>g.types[k]),tw=t.best_origin||{};
/* Select the fastest 1F among verified MAIN_WORKDAY wood sessions; keep the 4F from the same session. */
const woodMain=(g.source_records||[]).filter(x=>x.main_workday===true&&x.match_method==='STRICT_BLOODLINE_ID_AND_NAME'&&Number.isFinite(Number(x['1F']))&&Number.isFinite(Number(x['4F'])));
woodMain.sort((x,y)=>Number(x['1F'])-Number(y['1F'])||Number(x['4F'])-Number(y['4F']));
const raw119=m.target_training_observed_v119||null;
const ref120=m.v120_research_reference?.scope==='SAVED_RESEARCH_REPLAY_NOT_FORMAL_CERTIFICATION'?m.v120_research_reference:null;
const wood=woodMain[0]||null;
return{m,a,b,g,t,c,gold,tw,wood,raw119,ref120,woodMainCount:woodMain.length,
history:h[8]?.length||0,
top3:a['直近7走3着以内回数'],
same:a['同距離走数'],
near:a['直近7走着差0.8秒以内回数'],
prior:a['前走着順'],
position:b.position_category||b.position_profile||b.position_bucket,
rest:b.days_since_previous_run??b.rest_days,
train:m.training_status,
last5:c.last5_top3_n,
goldFlag:!!g.any_golden_v010,
twinFlag:!!tw.top5_uploaded_day_research};
};
const ys=hh.map(h=>{try{return window.v120Yasui?.evaluate(h,item.data.past_fields,r)||null}catch(e){return {no:Number(h[0]),error:e.message}}});window.v120Yasui?.rank(ys);
const records=hh.map(h=>({h,v:{yasui:ys.find(x=>x?.no===Number(h[0])),...summary(h),f103:fact(window.v103Facts,h),f105:fact(window.v105Facts,h),f106:fact(window.v106Facts,h),f94:fact(window.v94Facts,h),independent:(()=>{try{return window.v118Models?.evidence(h,item.data.past_fields,r)||null}catch(e){return null}})()}}));
const flagText=x=>x===true?'○':x===false?'×':'保留';
const independentMarket=v=>v.independent&&window.v118Models?.marketAfter(v.independent,currentMarket()?.single);
const auditBox=document.createElement('div');auditBox.style.cssText='background:#152e40;border:1px solid #4c697d;border-radius:9px;padding:8px;font-size:12px;margin:6px 0';auditNotes.append(auditBox);
function recovery(v){const a=v.f105.data,b=v.f106.data;return [a?.poor&&a.sd.top3?'凡走→適性':null,a?.clazz.startsWith('前走比クラス下降')?'級下降':null,b?.note.some(x=>x.startsWith('前走前方→ゴール後退'))?'失速×短縮':null].filter(Boolean);}
function auditOverview(){const n10=records.filter(x=>x.v.history===10).length,short=records.filter(x=>x.v.history<10&&x.v.m.completeness_confirmed!==true).length,checked=records.filter(x=>x.v.f103.data&&x.v.f105.data&&x.v.f106.data&&x.v.f94.data).length;const review=records.filter(x=>recovery(x.v).length).length;auditBox.replaceChildren(cell('strong','全頭走歴・見直し監査'),cell('div','10走収録 '+n10+'/'+hh.length+'頭｜10走未満・全歴要確認 '+short+'頭'),cell('div','4研究の計算結果 '+checked+'/'+hh.length+'頭｜条件変更・巻き返し観測 '+review+'頭'),cell('div','正式疲労指数・能力勝率・期待値は未確認／買い目HOLD'));const e3=records.filter(x=>x.v.independent?.E3===true).map(x=>x.h[0]+'番'),late=records.filter(x=>independentMarket(x.v)?.LATE7R===true).map(x=>x.h[0]+'番');auditBox.append(cell('div','EVIDENCE-3能力：'+(e3.join('・')||'該当観測なし')+'｜LATE-7R：'+(late.join('・')||'該当観測なし')+'（候補・未照合含む）'),cell('div','直結BP：'+(window.v118Models?.courseGate(r)||'未接続')+'｜安井式：3軸計算接続・最新ラップ／コース★未確認｜ICHIGEKI：COMPI・新Pマスター要確認'));}
function tag(text,kind){const n=cell('span',text,'rt-tag'+(kind?' '+kind:''));return n;}
function appendData(tr,value){const td=document.createElement('td');if(value instanceof Node)td.append(value);else{td.textContent=fmt(value);if(!valid(value))td.classList.add('rt-empty')}tr.append(td);return td;}
function extended(h,v){
const tr=document.createElement('tr');tr.className='rt-detailrow';const td=document.createElement('td');td.colSpan=5;
const grid=document.createElement('div');grid.className='rt-grid';
for(const [key,value] of [['過去走',v.history+'走'],['直近7走3着内',fmt(v.top3)+'回'],['同距離出走',fmt(v.same)+'走'],['0.8秒以内',fmt(v.near)+'回'],['同距離同面3着内',fmt(v.c.same_distance_surface_top3_7)],['現級同面0.5秒内',fmt(v.c.same_class_surface_within_half_sec_7)],['ウッド4F',v.wood?Number(v.wood['4F']).toFixed(1)+'秒':'未取得'],['ウッド終い1F',v.wood?Number(v.wood['1F']).toFixed(1)+'秒':'未取得']]){const box=document.createElement('div');box.className='rt-box';box.append(cell('small',key),cell('strong',value));grid.append(box);}
td.append(grid,cell('h4','調教・展開・注意'));
const a=v.f103.data,b=v.f105.data,p=v.f106.data,f=v.f94.data,x=currentCross(h);
const factLines=[['過去10走の好材料',a?a.observations.join('／')||'観測なし':'HOLD：'+v.f103.error],['条件変更',b?[b.movement,b.clazz,...b.tips].join('／'):'HOLD：'+v.f105.error],['位置取り',p?p.note.join('／')||'観測なし':'HOLD：'+v.f106.error],['連戦・休養（疲労指数とは別）',f?'14日以内 '+f.short+'/'+f.gaps.length+'回・今回間隔 '+(f.startGap??'不明')+'日':'HOLD：'+v.f94.error],['調教横断',x?[x.goldLabel,x.scoutLabel,x.rawText].join('\n'):'未照合'],['資料不足',x?x.missing.join('／')||'直前監査待ち':'横断SOURCE未確認']];
for(const [label,val] of factLines)td.append(cell('p',label+'：'+val,'rt-note'));
const y=v.yasui;td.append(cell('h4','安井式 V1.0｜独立能力計算（参考）'));if(y&&!y.error){td.append(cell('p','公式ラップ照合 '+y.matched+'/'+y.history+'走｜未照合 '+y.missing+'走｜全歴 '+(y.complete?'収録確認':'未確定'),'rt-note'));for(const [k,label] of [['stamina','スタミナ'],['speed','スピード'],['power','パワー']])td.append(cell('p',label+'：'+(y[k]?y[k].value.toFixed(2)+'秒／参考順位 '+y[k+'Rank']+'/'+y[k+'N']+'／根拠 '+y[k].date:'保留')+(y[k+'Other']?'／別面参考 '+y[k+'Other'].value.toFixed(2)+'秒（順位対象外）':''),'rt-note'));td.append(cell('p',y.status+'。参考順位を最終印に使わない。','rt-note'));}else td.append(cell('p','HOLD：'+(y?.error||'計算モジュール未接続'),'rt-note'));
const independent=v.independent,im=independentMarket(v);td.append(cell('h4','独自研究｜候補監査（正式総合印とは別）'),cell('p',independent?'CLASS05 '+flagText(independent.CLASS05)+'／TIMEHOLD2 '+flagText(independent.TIMEHOLD2)+'／NEAR10 '+flagText(independent.NEAR10)+'／EVIDENCE-3 '+flagText(independent.E3)+'\n市場照合（入力時点）：E3穴 '+flagText(im?.E3hole)+'／LATE-A '+flagText(im?.LATEA)+'／LATE-7R '+flagText(im?.LATE7R)+'／前走上がり順位 '+(independent.hasRank?'収録':'未収録'):'HOLD：独自研究に必要な走歴未照合','rt-note'));td.append(cell('p','E3は見える男V1.0本体とは別の候補。LATEはSECOND／THIRD／RESCUE監査。現時点の入力データからの観測で、勝率・最終印・買い目は未確定。','rt-note'));
const market=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0]));if(market){td.append(cell('h4','市場（入力時点）'),cell('p','単勝 '+market.win.toFixed(1)+'倍／複勝上限 '+market.place.toFixed(1)+'倍｜'+(market.groups.join('・')||'メジアン該当なし'),'rt-note'));}
const rawWood=v.raw119?.wood_fastest_4f,rawHill=v.raw119?.hill_fastest_4f;
if(v.raw119){td.append(cell('p','今週調教原票（正式黄金・双子判定とは別）：ウッド '+v.raw119.wood_rows+'件（ID＋馬名照合）／坂路 '+v.raw119.hill_rows+'件（馬名・厩舎・性齢照合、ID未確認）','rt-note'));if(rawWood)td.append(cell('p','ウッド最速4F原票 '+rawWood['年月日']+' '+rawWood['場所']+'／4F '+rawWood['4F']+'秒・終い '+rawWood['1F']+'秒','rt-note'));if(rawHill)td.append(cell('p','坂路最速4F原票 '+rawHill['年月日']+' '+rawHill['場所']+'／4F '+rawHill['Time1']+'秒・終い '+rawHill['Time4']+'秒（仮照合）','rt-note'));}
const ref=v.ref120;if(ref){td.append(cell('h4','調教研究候補（正式判定HOLD）'));td.append(cell('p','黄金4型の保存済み再現：'+(ref.gold_coverage?(ref.gold_types.join(' / ')||'観測範囲内非陽性'):'原票未観測')+'／DUALとSUST同一調教：'+flagText(ref.dual_sust_same_session),'rt-note'));for(const z of (ref.gold_rows||[]).filter(z=>z.types.length))td.append(cell('p',z.date+' '+z.place+' '+z.course+' '+z.turn+' '+z.time+'｜4F '+fmt(z['4F'])+'／1F '+fmt(z['1F'])+'｜'+z.types.join('・'),'rt-note'));const t=ref.twin||{};td.append(cell('p','双子原点保存参考：D_MEAN '+fmt(t.D_MEAN)+'／D_PICO '+fmt(t.D_PICO)+'／D_CATHEDRAL '+fmt(t.D_CATHEDRAL)+'／上位5% '+flagText(t.top5_test)+'／SESSION5厳密加速の保存候補 '+flagText(t.session5_strict_accel_saved)+'（別セッションの場合あり・正式式再実行なし）','rt-note'));for(const z of ref.previous_comparison||[])td.append(cell('p','前走比 '+z['種別']+' '+z['場所']+' '+z['コース']+'｜'+z['前走調教日']+'→'+z['今回調教日']+'｜4F '+z['前走4F']+'→'+z['今回4F']+'（改善 '+z['4F改善']+'）／1F '+z['前走1F']+'→'+z['今回1F']+'（改善 '+z['1F改善']+'）','rt-note'));td.append(cell('p','前走調教は保存済み比較表、今回調教は原票照合。坂路は血統ID未確認。正式双子・黄金・DUAL・疲労・見える男の認定ではない。','rt-note'));}
const woodDetail=v.wood?('代表追い切り：'+v.wood.date+' '+v.wood.place+' '+v.wood.turn+'回り／4F '+Number(v.wood['4F']).toFixed(1)+'秒・終い1F '+Number(v.wood['1F']).toFixed(1)+'秒／ID照合済み'):'ウッド：有効な主追い日の馬ID照合データなし';
const details=woodDetail+'\n黄金：'+(v.goldFlag?(v.gold.length?v.gold.join('＋'):'該当'):'非該当／未確認')+'\n双子原点：'+(Number.isFinite(Number(v.tw.origin_mean_D))&&valid(v.tw.origin_mean_D)?'D='+Number(v.tw.origin_mean_D).toFixed(3):'未取得')+'\n位置取り：'+fmt(v.position)+'／休み：'+fmt(v.rest)+'日\n調教照合：'+fmt(v.train);
td.append(cell('p',details,'rt-note'));
if(v.c.positive_evidence?.length)td.append(cell('p','好材料：'+v.c.positive_evidence.join('、'),'rt-note'));
if(v.c.cautions?.length)td.append(cell('p','注意：'+v.c.cautions.join('、'),'rt-note'));
td.append(cell('h4','過去走（収録 '+v.history+'走／最大10走）'));
if(!h[8]?.length)td.append(cell('p',v.m.entry_newcomer?'出馬表は新馬戦・TARGET過去走なし':'過去走なし／新馬も含む','rt-note'));
else{const wrap=document.createElement('div');wrap.className='rt-past';const t=document.createElement('table');const head=document.createElement('tr');
const columns=[['日付','date'],['場','racecourse'],['芝ダ','surface'],['距離','distance_m'],['級','class_name'],['馬場','going'],['着','finish_position'],['着差秒','margin_sec'],['時計秒','finish_time_seconds'],['上り3F','last3f_seconds'],['1角','corner_1'],['2角','corner_2'],['3角','corner_3'],['4角','corner_4'],['頭数','field_size'],['斤量','weight_kg'],['騎手','jockey'],['厩舎','trainer'],['馬体重','body_weight_kg'],['当時単勝','past_win_odds'],['SOURCE','source_status']];for(const [label] of columns)head.append(cell('th',label));t.append(head);
for(const p of h[8].slice().sort((a,b)=>String(b[ix.date]).localeCompare(String(a[ix.date])))){const row=document.createElement('tr');for(const [,field] of columns)row.append(cell('td',fmt(p[ix[field]])));t.append(row);}
wrap.append(t);td.append(wrap);}
tr.append(td);return tr;
}
function draw(){
table.replaceChildren();const hd=document.createElement('thead'),hr=document.createElement('tr');
table.style.minWidth=mode==='調教'?'530px':'0';
const cols=mode==='安井式'?['馬番','馬名','スタミナ','スピード','パワー']:mode==='調教候補'?['馬番','馬名','黄金※','双子※','前走比※']:mode==='独自研究'?['馬番','馬名','E3能力','E3穴','LATE7R']:mode==='見直し'?['馬番','馬名','同条件','見直し','過去穴']:mode==='市場'?['馬番','馬名','単勝','複上限','単×複']:mode==='総合'?['馬番','馬名','安井式※','調教※','好材料']:mode==='能力'?['馬番','馬名','3着内','同距離','0.8秒内']:mode==='調教'?['馬番','馬名','ウッド4F','終い1F','黄金／双子']:['馬番','馬名','位置','休養','前走'];
for(const text of cols)hr.append(cell('th',text));hd.append(hr);table.append(hd);const body=document.createElement('tbody');
for(const {h,v} of records){const row=document.createElement('tr');row.className='rt-row';row.setAttribute('aria-expanded',String(openHorse===h[0]));row.title=h[1]+'の詳細を表示';
const nb=appendData(row,h[0]);nb.className='rt-num';
const name=appendData(row,h[1]+' ▾');name.className='rt-horse';
if(mode==='総合'){
 const y=v.yasui,cap=document.createElement('span');for(const [k,label] of [['stamina','持'],['speed','速'],['power','力']])cap.append(cell('div',label+' '+(y?.[k]?y[k+'Rank']+'位':'—')));appendData(row,cap);
 const trn=document.createElement('span');if(v.goldFlag||v.ref120?.gold_types?.length)trn.append(tag('黄金※','rt-gold'));if(v.twinFlag||v.ref120?.twin?.session5_strict_accel_saved===true||v.ref120?.twin?.top5_test===true)trn.append(tag('双子※','rt-twin'));appendData(row,trn.childNodes.length?trn:'—');
 const signals=document.createElement('span'),a=v.f103.data,m=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])),im=independentMarket(v);
 if(a&&v.history)signals.append(cell('div','近5走③ '+a.top5+'回'));
 if(v.independent?.E3===true)signals.append(cell('div','見える男※'));
 if(im?.LATE7R===true)signals.append(cell('div','LATE7R※'));
 if(m?.cross)signals.append(cell('div','メジアン'));
 if(recovery(v).length)signals.append(cell('div','巻返し材料'));
 appendData(row,signals.childNodes.length?signals:'—');
}
if(mode==='能力'){appendData(row,valid(v.top3)?v.top3+'回':'—');appendData(row,valid(v.same)?v.same+'走':'—');appendData(row,valid(v.near)?v.near+'回':'—');}
if(mode==='調教'){const raw=v.raw119?.wood_fastest_4f;appendData(row,v.wood?Number(v.wood['4F']).toFixed(1):raw?raw['4F']+'※':'—');appendData(row,v.wood?Number(v.wood['1F']).toFixed(1):raw?raw['1F']+'※':'—');const tags=document.createElement('span');if(v.goldFlag)tags.append(tag(v.gold.length+'型','rt-gold'));if(v.twinFlag){if(tags.childNodes.length)tags.append(' ');tags.append(tag('双子※','rt-twin'));}appendData(row,tags.childNodes.length?tags:'—');}
if(mode==='調教候補'){const z=v.ref120;appendData(row,z?.gold_coverage?(z.gold_types.length?tag((z.dual_sust_same_session?'D+S ':'')+z.gold_types.length+'型','rt-gold'):'観測なし'):'未確認');appendData(row,z?.twin?.session5_strict_accel_saved===true?tag('S5候補','rt-twin'):z?.twin?.top5_test===true?tag('上位5%','rt-twin'):z?.twin?.raw_matched?'候補外':'未確認');appendData(row,z?.both_improved===true?tag('両改善','rt-gold'):z?.previous_comparison?.length?'比較あり':'未確認');}
if(mode==='安井式'){const y=v.yasui;for(const k of ['stamina','speed','power'])appendData(row,y?.[k]?y[k].value.toFixed(2)+' / '+y[k+'Rank']+'位※':'保留');}
if(mode==='独自研究'){const z=v.independent,q=independentMarket(v);appendData(row,flagText(z?.E3));appendData(row,flagText(q?.E3hole));appendData(row,flagText(q?.LATE7R));}
if(mode==='見直し'){const a=v.f103.data,b=v.f105.data,p=v.f106.data;appendData(row,a&&v.history?a.goodSame+'/'+a.sameDist:'未確認');const flags=recovery(v);appendData(row,flags.length?flags.join('・'):b&&p&&v.history?'なし':'未確認');appendData(row,a&&v.history&&h[8].some(p=>valid(p[ix.past_win_odds]))?a.outsider+'回':'未確認');}
if(mode==='市場'){const a=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0]));appendData(row,a?a.win.toFixed(1):'—');appendData(row,a?a.place.toFixed(1):'—');appendData(row,a?(a.cross?tag('重複','rt-gold'):'—'):'未取得');}
if(mode==='展開'){appendData(row,fmt(v.position));appendData(row,valid(v.rest)?v.rest+'日':'—');appendData(row,valid(v.prior)?v.prior+'着':'—');}
row.addEventListener('click',()=>{openHorse=openHorse===h[0]?null:h[0];draw();});body.append(row);
if(openHorse===h[0])body.append(extended(h,v));
}
table.append(body);status.textContent='全'+hh.length+'頭を1頭1行で表示｜'+mode+'｜行を押すと過去走・根拠を開閉'+(mode==='調教候補'?'｜※保存研究の参考候補。D+Sは同一調教。S5は保存候補。前走比は4F・1F。正式判定HOLD。':'');
btns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));otherSelect.value=primaryModes.includes(mode)?'':mode;otherSelect.setAttribute('aria-label','その他の研究：'+(primaryModes.includes(mode)?'選択':mode));
}
const primaryModes=['総合','安井式','調教','市場'];
for(const m of primaryModes){const b=cell('button',m==='総合'?'全頭一覧':m);b.type='button';b.dataset.mode=m;b.addEventListener('click',()=>{mode=preferredMode=m;openHorse=null;draw();});tabs.append(b);btns.push(b);}
const otherSelect=document.createElement('select');otherSelect.className='rt-research-select';option(otherSelect,'','その他の研究を選ぶ ▾');for(const m of modes.filter(x=>!primaryModes.includes(x)))option(otherSelect,m,m);otherSelect.addEventListener('change',()=>{if(otherSelect.value){mode=preferredMode=otherSelect.value;openHorse=null;draw();}});
const summaryBar=document.createElement('div');summaryBar.className='rt-brief';const quickMarket=document.createElement('span');const quickCoverage=document.createElement('span');summaryBar.append(quickMarket,quickCoverage);
function compactSummary(){const m=currentMarket(),gate=m?.favoriteGate?.gates.filter(x=>x.match===true).map(x=>x.name);quickMarket.textContent='市場：'+(gate?.length?gate.join('・')+'（参考）':m?.single?'照合済／荒れ判定保留':'オッズ未照合');quickCoverage.textContent='買い目保留｜10走収録 '+records.filter(x=>x.v.history===10).length+'/'+hh.length+'頭';}
const shortNote=cell('p','※安井式は照合済み履歴内の参考順位（持＝スタミナ、速＝スピード、力＝パワー）。調教・好材料は候補を含む。馬名を押すと根拠・過去走が開きます。','rt-foot');

dashboard.append(summaryBar,tabs,otherSelect,status,scroll,shortNote,marketFold,auditNotes);auditNotes.append(cell('p','ウッド4F・終い1Fは同一の主追い日から抽出（馬ID・馬名照合済）。黄金は保存済み4型の一致数。双子※は原点研究の当日上位5%のみで正式V0.21判定ではありません。未取得は「—」。※付きの時計は今週原票の最速4F（正式主追い日判定とは別）。坂路の仮照合は馬の詳細に表示。','rt-foot'));
dashboard.hidden=false;marketRedraw=()=>{compactSummary();marketOverview();auditOverview();draw();};marketRedraw();
}
venue.addEventListener('change',()=>{selection();if(bundle)go.click();});
race.addEventListener('change',()=>{const item=bundle?.races.find(x=>x.data.race.venue===venue.value&&x.data.race.date+'|'+x.data.race.race_no===race.value);if(item)go.click();});
go.addEventListener('click',()=>{
if(!bundle){$('bundleSettings').open=true;return busy('HOLD：統合データ未選択');}
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
busy(r.date+' '+r.venue+r.race_no+'R／'+r.horse_count+'頭の研究監査を起動しました。不足SOURCE：'+([...new Set(missing)].join('、')||'なし')+'。画面の全頭一覧を確認してください。直前情報・勝率・期待値が未検証なら馬券HOLD。');
/* Keep the mobile comparison table in view; detailed panels remain accessible via settings. */
}catch(e){busy('HOLD：'+e.message)}finally{go.disabled=false}
});
})();