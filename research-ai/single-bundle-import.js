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
// Add-only comparison; no new scoring or formal role promotion.
function flat147(r){return ['芝','ダ','ダート'].includes(r?.surface)&&!String(r?.class_name||'').includes('障害')&&!String(r?.race_name||'').includes('障害');}
function compare147({race,source,course,training,sourceWin,market,hr}){
 const unknown={ability:'未確認',training:[],pace:'未確認',wins:[],p9:false,warning:'',labels:[],market:'市場HOLD'};
 if(!flat147(race))return {...unknown,state:'別工程',warning:'障害は実戦対象外'};
 if(race.class_name==='新馬')return {...unknown,state:'新馬別工程',ability:'過去走なし／別監査',training:[...new Set(training||[])],market:market&&Number.isFinite(market.win)&&market.win>=1?market.win.toFixed(1)+'倍（入力時点）':'市場HOLD',warning:'新馬専用判定は未確定'};
 if(!source?.ok)return {...unknown,state:'資料HOLD',warning:source?.reason||'保存研究未収録'};
 const f=source.fields||{},q=course;
 const complete=!!q&&q.coverage===1,upper=complete&&q.rank<=3;
 const wins=Array.from({length:13},(_,i)=>'WIN'+String(i+1).padStart(2,'0')).filter(k=>['WIN01','WIN02','WIN03','WIN04','WIN05','WIN13'].includes(k)&&String(f['V15_'+k]).toUpperCase()==='TRUE');
 const pace=String(f.V5_展開参考役割||'未確認'),receiver=['前残りWATCH','中団受け皿WATCH','後方受け皿WATCH'].includes(pace),negative=['前崩れ注意WATCH','位置取り逆風WATCH'].includes(pace);
 const tr=[...new Set(training||[])],p9=String(f.V15_P9).toUpperCase()==='TRUE';
 const labels=[];
 if(upper&&wins.length)labels.push('上位×WIN');
 if(upper&&tr.length)labels.push('上位×調教');
 if(upper&&receiver)labels.push('上位×展開');
 if(p9&&sourceWin?.signals?.includes('WIN07'))labels.push('P9×WIN07参考');
 if(f.V15_市場前ルート==='勝ち型WATCH')labels.push('保存勝ち型WATCH');
 if(f.V10_役割再監査区分==='能力＋調教再監査')labels.push('保存能力＋調教');
 if(f.V10_役割再監査区分==='能力＋展開再監査')labels.push('保存能力＋展開');
 const warning=[f.V10_反証留保,negative?pace:'',q&&!complete?'能力軸欠損':'',q?'':'総合順位未算出'].filter(Boolean).join('／');
 const marketText=market&&Number.isFinite(market.win)&&market.win>=1?market.win.toFixed(1)+'倍（入力時点）':'市場HOLD';
 return {state:labels.length?'横断再監査':p9||hr==='YES'?'PLACE/能力保全':'通常監査',ability:q?q.rank+'位※ '+(q.coverage*100).toFixed(1)+'%':'★／能力HOLD',training:tr,pace,wins,p9,warning,labels,market:marketText,upper};
}
// Review lanes from the frozen WIN/P role studies; not a new score or betting rule.
function roles148({race,source,comparison,sourceWin,market,careerConfirmed}){
 const empty={win:false,place:false,hole:false,focus:false,why:[],final:'購入HOLD',role:'資料HOLD',warning:''};
 if(!flat147(race))return {...empty,role:'対象外'};
 if(race.class_name==='新馬')return {...empty,role:'新馬別工程'};
 if(!source?.ok)return {...empty,warning:source?.reason||'研究未照合'};
 const f=source.fields||{},c=comparison||{},why=[],wins=c.wins||[];
 if(f.V15_市場前ルート==='勝ち型WATCH')why.push('保存勝ち型WATCH');
 else if(f.V15_市場前ルート==='勝ち切り再監査_馬柱のみ')why.push('保存WIN馬柱再監査');
 if(wins.length)why.push(wins.join('・'));
 const ref07=sourceWin?.signals?.includes('WIN07')===true;
 if(ref07)why.push('WIN07参考（正式HOLD）');
 if(c.labels?.includes('上位×WIN'))why.push('安井総合上位×WIN参考');
 const win=why.length>0,place=String(f.V15_P9).toUpperCase()==='TRUE';
 const ps=Array.from({length:9},(_,i)=>'P'+(i+1)).filter(k=>String(f['V15_'+k]).toUpperCase()==='TRUE');
 const hole=ps.length>0||f.V15_市場前ルート==='穴型保全_市場待ち';
 if(place)why.push('P9：複勝・3着保全');
 if(hole)why.push('穴型 '+(ps.join('・')||'保存市場待ち'));
 const flip=place&&ref07;
 if(flip)why.push('PLACE→WIN FLIP再照合（正式WIN07・市場待ち）');
 const role=win&&place?'勝ち・複勝両方再監査':win?'勝ち切り再監査':place?'複勝・3着再監査':hole?'穴型・市場待ち':'通常・保全監査';
 const warning=[c.warning,careerConfirmed===true?'':'全歴独立確認HOLD'].filter(Boolean).join('／');
 const price=typeof market?.win==='number'&&Number.isFinite(market.win)&&market.win>=1?100/market.win:null;
 return {...empty,win,place,hole,focus:!!c.labels?.length,why,role,warning,flip,price};
}
// GAP is a descriptive rank difference, never a probability or a new buying threshold.
function marketGap151(snapshot,key,horseNumbers,now){
 const hold=reason=>({ok:false,reason,byNo:new Map()});
 if(!snapshot||snapshot.key!==key)return hold('発走前実オッズ未取得');
 if(!Number.isFinite(snapshot.at)||!Number.isFinite(snapshot.startMs)||snapshot.at>now||snapshot.at>=snapshot.startMs||now>=snapshot.startMs||now-snapshot.at>30*60000)return hold('時刻期限切れ／未照合');
 const rows=snapshot.rows,known=new Set(horseNumbers.map(Number));
 if(!Array.isArray(rows)||rows.length!==known.size||new Set(rows.map(x=>x.no)).size!==known.size||rows.some(x=>!known.has(x.no)||!Number.isFinite(x.win)||x.win<1||!Number.isFinite(x.place)||!Number.isFinite(x.placeLower)||x.placeLower<1||x.place<x.placeLower))return hold('全頭単複照合不成立');
 const byNo=new Map(rows.map(x=>[x.no,{...x,popularity:rows.filter(y=>y.win===x.win).length===1?1+rows.filter(y=>y.win<x.win).length:null,requiredWin:100/x.win,requiredPlaceLow:100/x.place,requiredPlaceHigh:100/x.placeLower}]));
 return {ok:true,reason:'公開実オッズ照合済（JRA確定値ではない）',time:snapshot.time,byNo};
}
function gapHorse151(m,no,q,source,hr,context,role){
 const row=m.byNo.get(Number(no)),base={row,delta:null,context:[],status:m.ok?'能力HOLD':m.reason,review:false};
 if(!row)return base;
 if(!source?.ok)return {...base,status:'研究照合HOLD'};
 if(!q||!Number.isInteger(q.rank)||q.coverage!==1)return {...base,status:'能力軸欠損／総合未算出'};
 if(row.popularity===null)return {...base,status:'単勝同率・人気順位HOLD'};
 const delta=row.popularity-q.rank,notes=[];
 if(hr==='YES')notes.push('HR05');
 if(['前残りWATCH','中団受け皿WATCH','後方受け皿WATCH'].includes(context))notes.push(context);
 return {...base,delta,context:notes,status:delta>0?'能力上位※':delta<0?'市場上位※':'順位一致※',review:delta>0&&notes.length>0&&!!(role?.win||role?.place||role?.hole)};
}

function installBundle(value,origin){bundle=readBundle(value);clearSelect(venue);clearSelect(race);
const active=bundle.races.filter(x=>flat147(x.data.race));const venues=[...new Set(active.map(x=>x.data.race.venue))];for(const v of venues)option(venue,v,v);
if(active.length){venue.value=active[0].data.race.venue;selection();race.value=active[0].data.race.date+'|'+active[0].data.race.race_no;}else{clearVisibleRace();go.disabled=true;busy('平地対象レースなし（元データは保持）');return;}
go.disabled=false;
const settings=$('bundleSettings');if(settings)settings.open=false;
busy(origin+'：平地'+active.length+'R（対象外'+(bundle.races.length-active.length)+'Rは元データに保持）。');
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
function selection(){if(!bundle)return;clearSelect(race);const selected=bundle.races.filter(x=>flat147(x.data.race)&&x.data.race.venue===venue.value);for(const item of selected)option(race,item.data.race.date+'|'+item.data.race.race_no,item.data.race.date+' '+item.data.race.race_no+'R '+(item.data.race.race_name||item.data.race.class_name||''));if(selected.length)renderFacts(selected[0]);else clearVisibleRace();}
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
try{await cacheWrite(json);busy('保存完了：次回からこの端末の同じブラウザで自動復元します。平地'+bundle.races.filter(x=>flat147(x.data.race)).length+'R。');}
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
let marketSummary=null,crossSummary=null,marketRedraw=null,preferredMode='暫定印';
window.addEventListener('v107-cross-summary',e=>{crossSummary=e.detail;marketRedraw?.();});
window.addEventListener('v96-market-summary',e=>{marketSummary=e.detail;marketRedraw?.();});
window.addEventListener('v151-live-market-change',()=>{marketRedraw?.();});
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
// Restored from yasui_course_weights_v1_0_v030.csv (2026-09-02 archive).
// Columns: venue,surface,distance,shape,SPEED,STAMINA,POWER,formal,source.
const COURSE146=[
['中京','芝',1200,'',4,2,3,true,'p146'],['中京','芝',1400,'',4,2,3,true,'p146'],['中京','芝',1600,'',4,3,3,true,'p146'],['中京','芝',2000,'',3,3,4,true,'p148–149'],['中京','芝',2200,'',3,3,4,true,'p148–149'],
['中山','ダ',1200,'',3,4,2,true,'p133–134'],['中山','ダ',1800,'',1,5,3,true,'p134'],['中山','ダ',2400,'',0,5,3,true,'p134'],['中山','ダ',2500,'',0,5,3,true,'p134'],
['中山','芝',1200,'外',4,null,null,false,'部分回収'],['中山','芝',1600,'外',3,3,2,true,'p132'],['中山','芝',1800,'内',3,3,2,true,'p132'],['中山','芝',2000,'内',2,4,3,true,'p132'],['中山','芝',2200,'外',3,4,3,true,'p133'],['中山','芝',2500,'内',2,4,3,true,'p133'],['中山','芝',3600,'内',1,5,3,true,'p133'],
['京都','ダ',1400,'',4,2,4,true,'p144'],['京都','ダ',1800,'',4,3,5,true,'p144'],['京都','ダ',1900,'',3,3,5,true,'p144'],['京都','芝',1200,'内',5,0,4,true,'p141'],['京都','芝',1400,'内',5,0,null,false,'p141 POWER未確認'],['京都','芝',3000,'外',3,3,5,true,'p144'],['京都','芝',3200,'外',3,3,5,true,'p144'],
['札幌','ダ',1700,'',4,3,4,true,'既存正式仕様'],
['東京','ダ',1300,'',4,2,5,true,'p128'],['東京','ダ',1400,'',4,2,5,true,'p128'],['東京','ダ',1600,'',4,2,5,true,'p128'],['東京','ダ',2100,'',4,2,5,true,'p130'],
['東京','芝',1400,'',5,0,5,true,'p128–130'],['東京','芝',1600,'',5,1,5,true,'p128–130'],['東京','芝',1800,'',5,1,5,true,'p128–130'],['東京','芝',2000,'',5,2,5,true,'p128'],['東京','芝',2300,'',5,2,5,true,'p128'],['東京','芝',2400,'',5,2,5,true,'p128'],['東京','芝',2500,'',5,3,5,true,'p128'],['東京','芝',3400,'',5,3,5,true,'p128'],
['阪神','芝',1200,'内',5,2,3,true,'p136'],['阪神','芝',1400,'内',4,2,3,true,'p136'],['阪神','芝',1600,'外',5,2,5,true,'p137'],['阪神','芝',1800,'外',5,2,5,true,'p137'],['阪神','芝',2000,'内',3,3,3,true,'p137'],['阪神','芝',2200,'内',3,4,null,false,'p137 POWER未回収']
];
function course146(r){
 const v=r.venue,s=r.surface==='ダート'?'ダ':r.surface,d=Number(r.distance_m);
 let shape=String(r.course_shape??'').trim().replace(/回り$/,'');
 let shapeSource=shape?'入力': '';
 // JRA Kyoto official course distance table: 1200 inner; 3000/3200 outer.
 const fixed=v==='京都'&&s==='芝'?({1200:'内',3000:'外',3200:'外'}[d]||''):'';
 if(!shape&&fixed){shape=fixed;shapeSource='JRA京都コースデータ';}
 if(shape&&fixed&&shape!==fixed)return {ok:false,reason:'入力コース形態とJRA固定形態が不一致'};
 const candidates=COURSE146.filter(x=>x[0]===v&&x[1]===s&&x[2]===d);
 const exact=candidates.find(x=>x[3]===shape);
 if(!exact)return {ok:false,reason:candidates.length?'コース形態未指定／不一致':'V0.30未登録',row:candidates.length===1?candidates[0]:null};
 const w={speed:exact[4],stamina:exact[5],power:exact[6]};
 return {ok:exact[7]&&Object.values(w).every(x=>Number.isInteger(x)&&x>=0&&x<=5)&&Object.values(w).some(x=>x>0),w,row:exact,shape,shapeSource,reason:exact[7]?'原本★登録済':'部分回収・正式不可'};
}
function provisional152(r,fields,getSaved,course){
 const out=new Map(),horses=r.horses||[],n=horses.length;
 if(!['芝','ダ'].includes(r.surface)||r.class_name==='新馬')return {out,order:horses.map(h=>Number(h[0])),reason:r.class_name==='新馬'?'新馬専用4本柱未接続':'対象外'};
 const ix=Object.fromEntries(fields.map((f,i)=>[f,i])),num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v),cl={'新馬':0,'未勝利':0,'1勝クラス':1,'2勝クラス':2,'3勝クラス':3,'L':4,'OP':4,'G3':5,'G2':6,'G1':7},venues=new Set(['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']),axes=['stamina','speed','power'];
 const rows=horses.map(h=>{const q=getSaved(h),m=q?.安井参考順位?.match(/^持(\d+|—)／速(\d+|—)／力(\d+|—)$/);return {h,q,ranks:m?m.slice(1).map(num):[null,null,null]};});
 const counts=axes.map((_,i)=>rows.filter(x=>x.ranks[i]!=null&&x.ranks[i]>=1).length),w=axes.map((k,i)=>counts[i]>=2?(course?.ok?course.w[k]:1):0),total=w.reduce((a,b)=>a+b,0);
 for(const {h,q,ranks} of rows){
  const no=Number(h[0]);if(!q){out.set(no,{reason:'V150保存監査未照合'});continue;}
  const usable=(h[8]||[]).filter(p=>p[ix.date]<r.date&&p[ix.source_status]==='STRICT_ID_MATCH'&&String(p[ix.abnormal_code])==='0'&&venues.has(p[ix.racecourse])&&num(p[ix.finish_position])>0&&num(p[ix.field_size])>1&&num(p[ix.finish_position])<=num(p[ix.field_size])).slice(0,10);
  let a=0,den=0;for(let i=0;i<3;i++){if(w[i]>0&&ranks[i]!=null&&ranks[i]>=1&&ranks[i]<=counts[i]){a+=w[i]*(1-(ranks[i]-1)/(counts[i]-1));den+=w[i];}}
  const form=usable.filter(p=>p[ix.surface]===r.surface&&Math.abs(Number(p[ix.distance_m])-Number(r.distance_m))<=200&&cl[p[ix.class_name]]!==undefined&&cl[r.class_name]!==undefined&&num(p[ix.margin_sec])!==null).map(p=>{const f=num(p[ix.finish_position]),gap=f===1?0:Math.max(0,num(p[ix.margin_sec])),level=Math.pow(.8,Math.max(0,cl[r.class_name]-cl[p[ix.class_name]]));return {f,level,merit:level*(.7*Math.max(0,1-gap/2)+.3*(1-(f-1)/(num(p[ix.field_size])-1)))};});
  if(!den&&!form.length){out.set(no,{reason:'同面能力・近距離実走不足',warning:q.留保,training:!!(q.黄金保存候補||q.双子保存候補)});continue;}
  const best=form.map(x=>x.merit).sort((a,b)=>b-a),fwin=best.length?(best[0]*.7+(best[1]??best[0])*.3):0,fplace=form.length?.5*fwin+.5*form.reduce((s,x)=>s+(x.f<=3?x.level:0),0)/form.length:0;
  const wins=(q.WIN馬柱||'').split('・'),ps=(q.P馬柱||'').split('・'),route=q.主ルート実績?.match(/^(\d+)勝・2\/3着(\d+)回／(\d+)走$/),rw=route?Number(route[1]):0,rp=route?Number(route[2]):0;
  const winRole=Math.max(wins.some(x=>['WIN02','WIN03'].includes(x))?1:0,wins.some(x=>['WIN01','WIN04','WIN05','WIN13'].includes(x))?.7:0,rw>0?.8:0,(q.横断再監査タグ||'').includes('P9×WIN07参考')?.6:0);
  const placeRole=Math.max(ps.includes('P9')?.8:0,ps.some(x=>/^P[1-6]$/.test(x))?.6:0,rw+rp>0?.8:0,wins.some(x=>/^WIN/.test(x))?.6:0);
  const gold=!!q.黄金保存候補,twin=!!q.双子保存候補,im=h[9]?.v120_research_reference?.both_improved===true,train=gold&&twin?10:gold||twin?7:im?5:0;
  const ability=total?40*a/total:0,win=ability+40*fwin+10*winRole+train,place=ability+40*fplace+10*placeRole+train;
  out.set(no,{win:+win.toFixed(3),place:+place.toFixed(3),ability:+ability.toFixed(2),formWin:+(40*fwin).toFixed(2),formPlace:+(40*fplace).toFixed(2),winRole:10*winRole,placeRole:10*placeRole,train,axis:den,total,formN:form.length,history:usable.length,warning:q.留保,mark:'',winRank:null,placeRank:null,reason:[q.安井参考順位,course?.ok?'★重み':'★未照合・等重み','近距離'+form.length+'走',q.WIN馬柱,q.P馬柱,gold?'黄金※':'',twin?'双子※':'',q.主ルート実績].filter(Boolean).join('／')});
 }
 const ranked=[...out].filter(([,x])=>Number.isFinite(x.win)),orderBy=k=>ranked.slice().sort((a,b)=>b[1][k]-a[1][k]||a[0]-b[0]),wr=orderBy('win'),pr=orderBy('place');
 for(const [arr,key,score] of [[wr,'winRank','win'],[pr,'placeRank','place']])arr.forEach(([no,x],i)=>x[key]=i&&x[score]===arr[i-1][1][score]?arr[i-1][1][key]:i+1);
 const marked=new Set();function markOne(arr,mark){const rem=arr.filter(([no])=>!marked.has(no));if(!rem.length)return false;const key=mark==='◎'?'win':'place',ties=rem.filter(([,x])=>x[key]===rem[0][1][key]);for(const [no,x] of ties){x.mark=mark+(ties.length>1?'同点':'');marked.add(no);}return true;}
 markOne(wr,'◎');markOne(pr,'○');markOne(pr,'▲');markOne(pr,'△');markOne(pr,'△');
 const order=[...marked,...wr.map(([no])=>no).filter(no=>!marked.has(no)),...horses.map(h=>Number(h[0])).filter(no=>!Number.isFinite(out.get(no)?.win))];
 return {out,order,reason:'暫定研究点・市場不使用・正式印／購入HOLD'};
}

function courseRank146(rows,r){
 const course=course146(r),out=new Map();
 if(!course.ok||r.class_name==='新馬'||!['芝','ダ','ダート'].includes(r.surface))return {course,out};
 const w=course.w,total=Object.values(w).reduce((a,b)=>a+b,0);
 for(const y of rows){if(!y||y.error)continue;let num=0,den=0;for(const k of ['speed','stamina','power']){const q=y.sourceRanks?.[k]?.rank;if(Number.isInteger(q)&&q>=1&&w[k]>0){num+=q*w[k];den+=w[k];}}
 if(den>0)out.set(y.no,{score:Math.round(num/den*10000)/10000,coverage:Math.round(den/total*1000)/1000,rank:null,formal:false});}
 const sorted=[...out.values()].sort((a,b)=>a.score-b.score);let last=null,rank=0;sorted.forEach((x,i)=>{if(x.score!==last)rank=i+1;last=x.score;x.rank=rank;});
 return {course,out};
}

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
const modes=['暫定印','実戦比較','市場乖離','総合','取捨監査','勝ち役割','候補保全','横断候補','実走反証','能力','調教','展開','市場','見直し','独自研究','調教候補','安井式','安井総合','安井原本照合','天照HR05'];tabs.style.gridTemplateColumns='repeat(4,minmax(0,1fr))';
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
const ys=hh.map(h=>{try{return window.v120Yasui?.evaluate(h,item.data.past_fields,r)||null}catch(e){return {no:Number(h[0]),error:e.message}}});window.v120Yasui?.rank(ys);window.v120Yasui?.sourceRank132?.(ys);const courseAudit146=courseRank146(ys,r);
const records=hh.map(h=>({h,v:{yasui:ys.find(x=>x?.no===Number(h[0])),...summary(h),f103:fact(window.v103Facts,h),f105:fact(window.v105Facts,h),f106:fact(window.v106Facts,h),f94:fact(window.v94Facts,h),independent:(()=>{try{return window.v118Models?.evidence(h,item.data.past_fields,r)||null}catch(e){return null}})()}}));
const flagText=x=>x===true?'○':x===false?'×':'保留';
const independentMarket=v=>v.independent&&window.v118Models?.marketAfter(v.independent,currentMarket()?.single);
const hrRows=new Map(records.map(({h})=>[Number(h[0]),hr129(h,item.data.past_fields,r)]));
function hrInfo129(h,v){const z=hrRows.get(Number(h[0])),fav=favorite126(currentMarket(),records),rank=fav.favorite?fav.rank(h[0]):null;return {z,rank,role:hrRole129(z,v.independent?.E3,rank)};}
const paceRows=new Map(records.map(({h})=>[Number(h[0]),pace126(h,item.data.past_fields,r)]));
const auditBox=document.createElement('div');auditBox.style.cssText='background:#152e40;border:1px solid #4c697d;border-radius:9px;padding:8px;font-size:12px;margin:6px 0';auditNotes.append(auditBox);
function recovery(v){const a=v.f105.data,b=v.f106.data;return [a?.poor&&a.sd.top3?'凡走→適性':null,a?.clazz.startsWith('前走比クラス下降')?'級下降':null,b?.note.some(x=>x.startsWith('前走前方→ゴール後退'))?'失速×短縮':null].filter(Boolean);}
function v125Evidence(v,marketRow,im){
 const a=v.f103?.data,z=v.ref120,ability=[],training=[],review=recovery(v),market=[];
 if(v.history>0&&a?.top5>=2)ability.push('近5走③内2回以上');
 if(v.history>0&&a?.goodSameCourse>0)ability.push('同場同距離③内');
 else if(v.history>0&&a?.goodSame>0)ability.push('同芝ダ同距離③内');
 if(v.independent?.E3===true)ability.push('EVIDENCE-3');
 if(v.goldFlag)training.push('黄金※');
 if(z?.gold_types?.length)training.push(z.dual_sust_same_session===true?'DUAL+SUST※':'黄金再現※');
 if(v.twinFlag||z?.twin?.top5_test===true)training.push('双子上位5%※');
 if(z?.twin?.session5_strict_accel_saved===true)training.push('SESSION5※');
 if(z?.both_improved===true)training.push('前走比4F・1F改善※');
 if(marketRow?.cross===true)market.push('単複上限メジアン');
 if(im?.E3hole===true)market.push('E3穴※');
 if(im?.LATE7R===true)market.push('LATE7R※');
 const abilityTraining=ability.length>0&&training.length>0;
 const recoveryTraining=review.length>0&&training.length>0;
 return {ability,training,review,market,abilityTraining,recoveryTraining,marketObserved:!!marketRow};
}
function saved127(h){
 const ref=h?.[9]?.research_bridge_v127;
 if(ref?.status!=='SAVED_OBSERVATION_MATCHED'||!ref.fields||typeof ref.fields!=='object')return {ok:false,reason:ref?.reason||'研究統合JSON未収録',fields:{}};
 const fields=ref.fields;
 return {ok:true,fields,source:ref.source,scope:ref.scope};
}
function saved127Race(item){
 const ref=item?.research_bridge_v127_race;
 if(ref?.status!=='SAVED_OBSERVATION_MATCHED'||!ref.fields)return {ok:false,reason:ref?.status==='HOLD_HISTORY_MISMATCH'?'取消・除外の照合差あり：'+(ref.affected_numbers||[]).join('・')+'番':'保存前圧データ未収録'};
 return {ok:true,fields:ref.fields};
}
function hr129(h,fields,r){
 const codes={'1勝クラス':'23','2勝クラス':'43','3勝クラス':'67','L':'115','OP':'131','G3':'163','G2':'179','G1':'195'};
 const code=codes[r.class_name];if(!code||!['芝','ダ'].includes(r.surface))return {state:'OUT',hits:[]};
 if(h[9]?.research_bridge_v127?.status==='HOLD_HISTORY_MISMATCH')return {state:'HOLD',hits:[],reason:'取消・除外照合差'};
 const needed=['date','race_id','source_status','racecourse','surface','class_name','class_code','distance_m','finish_position','margin_sec','abnormal_code'];
 if(!Array.isArray(fields)||needed.some(k=>!fields.includes(k))||new Set(fields).size!==fields.length||!Array.isArray(h[8])||h[8].length>10)return {state:'HOLD',hits:[],reason:'必須走歴不足'};
 const n=v=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
 if(!Number.isFinite(Number(r.distance_m))||Number(r.distance_m)<=0)return {state:'HOLD',hits:[],reason:'距離未確定'};
 const rows=h[8].map(a=>Array.isArray(a)&&a.length===fields.length?Object.fromEntries(fields.map((k,i)=>[k,a[i]])):null);
 if(rows.some(x=>!x||!/^\d{4}-\d\d-\d\d$/.test(String(x.date))||x.date>=r.date||x.source_status!=='STRICT_ID_MATCH'||!x.race_id)||new Set(rows.map(x=>x.race_id)).size!==rows.length)return {state:'HOLD',hits:[],reason:'ID・発走前日付不正'};
 const recent=rows.sort((a,b)=>b.date.localeCompare(a.date)||String(b.race_id).localeCompare(String(a.race_id))).slice(0,8);
 let unknown=false;const hits=[];
 for(const x of recent){
 const tests=[x.racecourse?x.racecourse===r.venue:null,x.surface?x.surface===r.surface:null,x.class_name?x.class_name===r.class_name:null,x.class_code!=null&&String(x.class_code).trim()!==''?String(x.class_code)===code:null,n(x.distance_m)==null?null:Math.abs(n(x.distance_m)-Number(r.distance_m))<=200,n(x.finish_position)==null?null:[2,3].includes(n(x.finish_position)),n(x.margin_sec)==null?null:n(x.margin_sec)>=0&&n(x.margin_sec)<=.5+1e-12,n(x.abnormal_code)==null?null:n(x.abnormal_code)===0];
 if(tests.every(v=>v===true))hits.push(x);else if(!tests.includes(false)&&tests.includes(null))unknown=true;
 }
 if(hits.length)return {state:'YES',hits};
 return recent.length===8||h[9]?.completeness_confirmed===true?unknown?{state:'HOLD',hits,reason:'該当可能走の項目不足'}:{state:'NO',hits}:{state:'HOLD',hits,reason:'8走未満・全歴未確定'};
}
function hrRole129(h,e3,rank){
 if(h.state!=='YES')return h.state==='OUT'?'対象外':h.state==='NO'?'非該当':'資料HOLD';
 if(e3===true)return 'STRONG-RECHECK';
 if(rank===null||rank===undefined)return 'HR05・人気待ち';
 if(rank>=4&&rank<=7)return 'HEAD-PACK再監査';
 if(rank>=8)return 'PLACE/RESCUE再監査';
 return 'HR05・能力証拠保全';
}
function preserve130(input){
 const {eligible,quarantine,saved,hr,e3,late,cross,rank,odds}=input;
 if(!eligible)return {state:'別枠',ability:[],other:[],route:[],deep:'対象外',warning:'新馬・障害は別工程'};
 if(quarantine)return {state:'照合HOLD',ability:[],other:[],route:[],deep:'HOLD',warning:'取消・除外照合差。役割降格禁止'};
 const f=saved||{},ability=[],other=[],route=[];
 if(['RESCUE-A','RESCUE-B','RESCUE-B以上_A未確定'].includes(f['V13_FORM_RESCUE']))ability.push(f['V13_FORM_RESCUE']+'※');
 if(['DIRECT-SINGLE参考','DIRECT-REPEAT-A参考'].includes(f['V14_DIRECT_ROLE']))ability.push(f['V14_DIRECT_ROLE']);
 if(hr==='YES')ability.push('HR05');
 if(e3===true)ability.push('E3※');
 if(late===true)other.push('LATE-7R※');
 if(f['V13_RF30部分']==='WATCH')other.push('RF30部分WATCH');
 for(const x of cross?.training||[])if(!other.includes(x))other.push(x);
 for(const k of ['V15_市場前ルート'])if(['勝ち型WATCH','勝ち切り再監査_馬柱のみ','穴型保全_市場待ち','PLACE再監査_P9'].includes(f[k]))other.push(f[k]+'※');
 if(['能力証拠保全','能力＋調教再監査','能力＋展開再監査','調教観測・能力要確認'].includes(f['V10_役割再監査区分']))other.push(f['V10_役割再監査区分']+'※');
 if(['前残りWATCH','中団受け皿WATCH','後方受け皿WATCH'].includes(f['V5_展開参考役割']))route.push(f['V5_展開参考役割']);
 const active=ability.length+other.length+route.length>0;
 const validRank=Number.isInteger(rank)&&rank>0,validOdds=typeof odds==='number'&&Number.isFinite(odds)&&odds>=1;
 const deep=validRank&&rank>=8||validOdds&&odds>=30?'DEEP（8人気以下／30倍以上）':validRank&&rank>=6||validOdds&&odds>=15?'6人気以下／15倍以上':validRank&&validOdds?'通常市場帯':'市場HOLD';
 return {state:active?'PRESERVED-WATCH':saved?'通常監査継続':'資料HOLD',ability,other,route,deep:active?deep:'—',warning:f['V10_反証留保']||'',h2:'当日勝ち筋未確定',h3:'独立強信号の正式照合待ち',recency:'公式最新走・母艦上限の突合待ち'};
}
function sourceWin132(y,market,form){
 const ranks=['stamina','speed','power'].map(k=>y?.sourceRanks?.[k]?.rank??null);
 const top=ranks.filter(x=>Number.isInteger(x)&&x>=1&&x<=3).length,first=ranks.includes(1);
 const rank=market?.rank,odds=market?.odds;
 const popular=Number.isInteger(rank)&&rank>=1&&rank<=3,under=Number.isInteger(rank)&&rank>=4||typeof odds==='number'&&Number.isFinite(odds)&&odds>=10;
 return {ranks,signals:[top>=2?'WIN06':null,top>=2&&first?'WIN07':null,top>=2&&popular?'WIN08':null,top>=2&&under?'WIN09':null,top>=2&&popular&&form===true?'WIN11':null,first?'WIN12':null].filter(Boolean),formal:'HOLD：全歴・ラップ・正式順位未確定'};
}
function win131(h,v,total,rank){
 const z=saved127(h),pv=route128(h),f=z.fields||{},y=v.yasui;
 if(!z.ok)return {state:'資料HOLD',p9:null,wins:[],pending:[],axes:[],ref07:null,flip:'HOLD',reason:z.reason};
 if(pv.key==='別枠')return {state:'別枠',p9:null,wins:[],pending:[],axes:[],ref07:null,flip:'対象外',reason:'新馬・障害は別工程'};
 const p9=f.V15_P9==='TRUE'?true:f.V15_P9==='FALSE'?false:null;
 const wins=pv.flags.filter(k=>k.startsWith('WIN')),pending=pv.pending.filter(k=>k.startsWith('WIN'));
 const axes=['stamina','speed','power'].map((k,i)=>({k,label:['持','速','力'][i],rank:Number.isInteger(y?.[k+'Rank'])&&y[k+'Rank']>=1?y[k+'Rank']:null,n:Number.isInteger(y?.[k+'N'])?y[k+'N']:0}));
 const top=axes.filter(a=>a.rank!==null&&a.rank<=3),first=top.some(a=>a.rank===1);
 const ref07=top.length>=2&&first?true:null;
 const formal07=f.V15_WIN07==='TRUE'?true:f.V15_WIN07==='FALSE'?false:null;
 const hole=rank&&Number.isInteger(rank.rank)&&rank.rank>=6||typeof rank?.odds==='number'&&rank.odds>=15?true:null;
 let flip='対象未確定';
 if(p9===false)flip='P9非該当';
 if(p9===true)flip=formal07===true&&hole===true?'FLIP再監査（保存正式型＋入力時点市場）':formal07===false?'P9：PLACE/THIRD':formal07===null?'P9保全・WIN07正式HOLD':'P9＋WIN07・穴市場待ち';
 const state=pv.key==='勝ち型WATCH'?'勝ち型WATCH':pv.key==='勝ち切り再監査_馬柱のみ'?'WIN馬柱再監査':p9===true?'PLACE保全・勝ち型確認':pv.key==='穴型保全_市場待ち'?'穴保全':pv.key==='HOLD'?'資料HOLD':'通常監査';
 return {state,p9,wins,pending,axes,ref07,formal07,flip,total,reason:'参考順位は算出可能馬内。正式WIN07/HEADと区別。',hole};
}
function route128(h){
 const z=saved127(h);if(!z.ok)return {key:'HOLD',label:'照合保留',reason:z.reason,flags:[],pending:[],warning:''};
 const f=z.fields,key=f['V15_市場前ルート'];
 const labels={'勝ち型WATCH':'勝ち型WATCH','勝ち切り再監査_馬柱のみ':'勝ち切り再監査','穴型保全_市場待ち':'穴型・市場待ち','PLACE再監査_P9':'PLACE再監査','既存監査維持':'通常監査','別枠':'新馬・障害別枠'};
 if(!Object.prototype.hasOwnProperty.call(labels,key))return {key:'HOLD',label:'研究未収録',reason:'V15市場前ルート未確認',flags:[],pending:[],warning:''};
 const fields=[...Array.from({length:9},(_,i)=>'P'+(i+1)),...Array.from({length:13},(_,i)=>'WIN'+String(i+1).padStart(2,'0'))];
 return {key,label:labels[key],flags:fields.filter(k=>String(f['V15_'+k]).toUpperCase()==='TRUE'),pending:fields.filter(k=>String(f['V15_'+k]??'').startsWith('HOLD')||f['V15_'+k]==null),warning:f['V10_反証留保']||'',role:f['V10_役割再監査区分']||'',pace:f['V5_展開参考役割']||'',ability:f['V10_能力根拠群']||'',training:f['V10_調教根拠群']||'',reason:'保存済みV15市場前ルート。正式発券HOLD'};
}
function price128(row){return typeof row?.win==='number'&&Number.isFinite(row.win)&&row.win>=1?100/row.win:null;}
function saved127Flag(x){return x===true||x==='True'||x==='true'||x==='1';}
function pace126(h,fields,r){
 const n=x=>x==null||String(x).trim()===''?null:Number.isFinite(Number(x))?Number(x):null;
 if(!Array.isArray(h[8])||h[8].length>10)return null;
 const rows=h[8].map(a=>Object.fromEntries(fields.map((k,i)=>[k,a[i]]))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 if(rows.some(x=>!x.date||x.date>=r.date||x.source_status!=='STRICT_ID_MATCH'))return null;
 const same=rows.filter(x=>x.surface===r.surface&&n(x.distance_m)===n(r.distance_m));
 const valid=[];for(const x of same){const size=n(x.field_size),finish=n(x.finish_position);if(!Number.isInteger(size)||size<2||!Number.isInteger(finish)||finish<1||finish>size)continue;
 const corners=[x.corner_1,x.corner_2,x.corner_3,x.corner_4].map(n),i=corners.findIndex(c=>Number.isInteger(c)&&c>=1&&c<=size);
 if(i<0)continue;const early=corners[i],late=corners[3],hasLate=Number.isInteger(late)&&late>=1&&late<=size;
 valid.push({date:x.date,size,early,corner:i+1,lead:early===1,front:early/size<=1/3,deep:early/size>2/3,gain:hasLate&&(early-late)/size>=.2,fade:hasLate&&early/size<=1/3&&(late-finish)/size<=-.2,hasLate});
 }
 return {same:same.length,valid:valid.length,lead:valid.filter(x=>x.lead).length,front:valid.filter(x=>x.front).length,deep:valid.filter(x=>x.deep).length,gain:valid.filter(x=>x.gain).length,fade:valid.filter(x=>x.fade).length,lateCount:valid.filter(x=>x.hasLate).length,latest:valid[0]||null};
}
function favorite126(m,records){
 const rows=m?.single?.rows;
 if(!Array.isArray(rows)||rows.length!==records.length||new Set(rows.map(x=>Number(x.no))).size!==records.length||rows.some(x=>!Number.isFinite(x.win)||x.win<1||!records.some(y=>Number(y.h[0])===Number(x.no))))return {status:'単複全頭未照合',favorite:null,gates:[]};
 const sorted=rows.slice().sort((a,b)=>a.win-b.win||a.no-b.no);
 if(sorted.length<2||sorted[0].win===sorted[1].win)return {status:'1番人気同率・保留',favorite:null,gates:[]};
 const fav=records.find(x=>Number(x.h[0])===Number(sorted[0].no)),g=m.favoriteGate;
 return {status:'入力時点の参考',favorite:fav,odds:sorted[0].win,gates:g?.favorite===sorted[0].no?(g.gates||[]):[],rank:no=>{const x=sorted.find(y=>Number(y.no)===Number(no));return !x||sorted.filter(y=>y.win===x.win).length>1?null:sorted.filter(y=>y.win<x.win).length+1;}};
}
function sourceWinInfo132(h,v){const z=saved127(h);if(!z.ok||!['芝','ダ'].includes(r.surface)||r.class_name==='新馬')return {signals:[],formal:'HOLD／別枠',ranks:[null,null,null]};const fav=favorite126(currentMarket(),records),mr=fav.favorite?currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])):null;return sourceWin132(v.yasui,{rank:fav.favorite?fav.rank(h[0]):null,odds:mr?.win},route128(h).flags.some(k=>/^WIN0[1-5]$/.test(k)));}
function winInfo131(h,v){const fav=favorite126(currentMarket(),records),mr=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0]));return win131(h,v,hh.length,{rank:fav.favorite?fav.rank(h[0]):null,odds:mr?.win});}
function preserveInfo130(h,v){
 const z=saved127(h),fav=favorite126(currentMarket(),records),mr=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0]));
 return preserve130({eligible:['芝','ダ'].includes(r.surface)&&r.class_name!=='新馬',quarantine:h[9]?.research_bridge_v127?.status==='HOLD_HISTORY_MISMATCH',saved:z.ok?z.fields:null,hr:hrRows.get(Number(h[0]))?.state,e3:v.independent?.E3,late:independentMarket(v)?.LATE7R,cross:cross125(h,v),rank:fav.favorite?fav.rank(h[0]):null,odds:mr?.win});
}
function rolesInfo148(h,v){return roles148({race:r,source:saved127(h),comparison:compareInfo147(h,v),sourceWin:sourceWinInfo132(h,v),market:currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])),careerConfirmed:h[9]?.completeness_confirmed===true});}
function savedCross150(h){const z=h?.[9]?.research_cross_v150,q=z?.fields;return z?.status==='REFERENCE_ONLY'&&z?.source==='V149_平地331頭_負荷回復速度監査.csv'&&r.date==='2026-11-28'&&q?.場===r.venue&&Number(q.R)===Number(r.race_no)&&Number(q.馬番)===Number(h[0])&&q.馬名===h[1]&&String(q.血統登録番号)===String(h[2])&&q.AUTO_BET===false&&q.正式最終印==='HOLD'?q:null;}
function verifiedMarket151(){return marketGap151(window.v151LiveMarket?.get(),currentKey,hh.map(h=>h[0]),Date.now());}
function gapInfo151(h,v,m=verifiedMarket151()){const z=saved127(h);return gapHorse151(m,h[0],courseAudit146.out.get(Number(h[0])),z,hrRows.get(Number(h[0]))?.state,z.fields?.V5_展開参考役割,rolesInfo148(h,v));}
function compareInfo147(h,v){return compare147({race:r,source:saved127(h),course:courseAudit146.out.get(Number(h[0])),training:cross125(h,v).training,sourceWin:sourceWinInfo132(h,v),market:currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])),hr:hrRows.get(Number(h[0]))?.state});}
function cross125(h,v){return v125Evidence(v,currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])),independentMarket(v));}
function auditOverview(){const n10=records.filter(x=>x.v.history===10).length,short=records.filter(x=>x.v.history<10&&x.v.m.completeness_confirmed!==true).length,checked=records.filter(x=>x.v.f103.data&&x.v.f105.data&&x.v.f106.data&&x.v.f94.data).length;const review=records.filter(x=>recovery(x.v).length).length;auditBox.replaceChildren(cell('strong','全頭走歴・見直し監査'),cell('div','10走収録 '+n10+'/'+hh.length+'頭｜10走未満・全歴要確認 '+short+'頭'),cell('div','4研究の計算結果 '+checked+'/'+hh.length+'頭｜条件変更・巻き返し観測 '+review+'頭'),cell('div','正式疲労指数・能力勝率・期待値は未確認／買い目HOLD'));const e3=records.filter(x=>x.v.independent?.E3===true).map(x=>x.h[0]+'番'),late=records.filter(x=>independentMarket(x.v)?.LATE7R===true).map(x=>x.h[0]+'番');auditBox.append(cell('div','EVIDENCE-3能力：'+(e3.join('・')||'該当観測なし')+'｜LATE-7R：'+(late.join('・')||'該当観測なし')+'（候補・未照合含む）'),cell('div','直結BP：'+(window.v118Models?.courseGate(r)||'未接続')+'｜安井式：3軸計算接続・最新ラップ／コース★未確認｜ICHIGEKI：COMPI・新Pマスター要確認'));}
function tag(text,kind){const n=cell('span',text,'rt-tag'+(kind?' '+kind:''));return n;}
function appendData(tr,value){const td=document.createElement('td');if(value instanceof Node)td.append(value);else{td.textContent=fmt(value);if(!valid(value))td.classList.add('rt-empty')}tr.append(td);return td;}
function extended(h,v){
const tr=document.createElement('tr');tr.className='rt-detailrow';const td=document.createElement('td');td.colSpan=5;
const grid=document.createElement('div');grid.className='rt-grid';
for(const [key,value] of [['過去走',v.history+'走'],['直近7走3着内',fmt(v.top3)+'回'],['同距離出走',fmt(v.same)+'走'],['0.8秒以内',fmt(v.near)+'回'],['同距離同面3着内',fmt(v.c.same_distance_surface_top3_7)],['現級同面0.5秒内',fmt(v.c.same_class_surface_within_half_sec_7)],['ウッド4F',v.wood?Number(v.wood['4F']).toFixed(1)+'秒':'未取得'],['ウッド終い1F',v.wood?Number(v.wood['1F']).toFixed(1)+'秒':'未取得']]){const box=document.createElement('div');box.className='rt-box';box.append(cell('small',key),cell('strong',value));grid.append(box);}
td.append(grid);const mg=gapInfo151(h,v);td.append(cell('h4','市場乖離・発走前実オッズ'),cell('p',mg.status+(mg.delta!=null?'／人気順位−安井総合参考順位 '+mg.delta:'')+'。能力計算に市場は混ぜない。','rt-note'));if(mg.row)td.append(cell('p','単勝必要勝率 '+mg.row.requiredWin.toFixed(2)+'%／複勝対象着順の必要的中率目安 '+mg.row.requiredPlaceLow.toFixed(2)+'–'+mg.row.requiredPlaceHigh.toFixed(2)+'%（発売条件の複勝対象着順による）。予測確率・期待値ではない。','rt-note'));if(mg.context.length)td.append(cell('p','条件参考：'+mg.context.join('・')+'／正式CONTEXT/FIT未確定。','rt-note'));const saved=savedCross150(h);if(saved)td.append(cell('h4','保存横断監査 V150（参考）'),cell('p','再監査：'+(saved.横断再監査タグ||'追加重点タグなし')+'／'+saved.既存役割参考,'rt-note'),cell('p','主ルート '+saved.主ルート+'：'+saved.主ルート実績+'／前圧 '+saved.前圧参考+'／間隔 '+(saved.間隔日||'不明')+'日','rt-note'),cell('p','留保：'+saved.留保+'。保存時点の参考順位・観測であり、現在の原本順位・正式役割を上書きしない。','rt-note'));const lane=rolesInfo148(h,v);td.append(cell('h4','役割再監査｜'+lane.role),cell('p','根拠：'+(lane.why.join('／')||'追加WIN・P点灯未観測／既存保全継続')+'｜'+lane.final,'rt-note'),cell('p','反証・留保：'+(lane.warning||'未確認含む')+'。人気・オッズだけの除外なし。自動HEAD・CUT・購入なし。','rt-note'));if(lane.price!=null)td.append(cell('p','単勝損益分岐勝率 '+lane.price.toFixed(2)+'%（予測勝率ではない）','rt-note'));const cv=compareInfo147(h,v);td.append(cell('h4','実戦横断比較｜'+cv.state),cell('p','照合：'+(cv.labels.join('・')||'追加重複なし／未確認含む')+'｜反証・留保：'+(cv.warning||'保存範囲で未観測')+'。正式な勝ち筋・H1/H2/H3・最終印は別途HOLD。','rt-note'));const cs=courseAudit146.course,cq=courseAudit146.out.get(Number(h[0]));td.append(cell('h4','安井式コース重要度 V0.30'),cell('p',cs.ok?'速★'+cs.w.speed+'／持★'+cs.w.stamina+'／力★'+cs.w.power+'｜'+cs.row[8]:'HOLD：'+cs.reason,'rt-note'));if(cq)td.append(cell('p','原本総合参考 '+cq.rank+'位／'+cq.score.toFixed(4)+'｜重み付き能力充足 '+(cq.coverage*100).toFixed(1)+'%。欠損軸は分母から外す原本仕様。全歴の完全性・最終印とは別。','rt-note'));const sw=sourceWinInfo132(h,v),sy=v.yasui;td.append(cell('h4','安井式 原本方式・WIN照合'),cell('p','原本方式の参考点灯：'+(sw.signals.join('・')||'未観測・未確認含む')+'。'+sw.formal,'rt-note'));
if(sy?.sourceValues){for(const k of ['stamina','speed','power']){const a=sy.sourceValues[k],q=sy.sourceRanks?.[k],c=sy.sourceCoverage[k];td.append(cell('p',k+'：'+(a&&q?a.value.toFixed(2)+'／'+q.rank+'/'+q.n+'位（全'+hh.length+'頭） '+sy.sourceBasis[k]+' 根拠 '+a.date:'未照合')+'／同面有効 '+c.usable+'/'+c.required+'走','rt-note'));}td.append(cell('p','全歴独立確認：'+(sy.sourceCareerConfirmed?'済':'未確認')+'／TARGET参照結合：'+(sy.sourceLinkedComplete?'一致':'未確認')+'／古馬直近4走同面SPEED資料：'+(sy.sourceRecent4Linked?'収録範囲で照合済':'未確認・対象外')+'。別面を含める原本の順位は従来の同面順位と別表示。','rt-note'));}
const wr=winInfo131(h,v);td.append(cell('h4','勝ち役割監査｜'+wr.state),cell('p','保存WIN点灯：'+(wr.wins.join('・')||'未点灯・未確認含む')+'／保留：'+(wr.pending.join('・')||'なし'),'rt-note'),cell('p','P9：'+flagText(wr.p9)+'／'+wr.flip,'rt-note'));
if(wr.axes.length)td.append(cell('p','安井式の参考順位：'+wr.axes.map(a=>a.label+' '+(a.rank===null?'未照合':a.rank+'/'+a.n+'位（全'+hh.length+'頭）')).join('／')+'。'+(wr.ref07===true?'参考2軸3位以内・首位あり。':'参考WIN07成立は未確認。')+'正式WIN07判定とは別。','rt-note'));
td.append(cell('p',wr.reason,'rt-note'));const pv=preserveInfo130(h,v);td.append(cell('h4','候補保全｜'+pv.state),cell('p','保全根拠：'+([...pv.ability,...pv.other,...pv.route].join('／')||'陽性観測なし・未確認含む'),'rt-note'));if(pv.state==='PRESERVED-WATCH')td.append(cell('p','市場：'+pv.deep+'｜H1能力参考：'+(pv.ability.join('・')||'未確認')+'｜H2：'+pv.h2+'｜H3：'+pv.h3,'rt-note'),cell('p','SOURCE RECENCY：'+pv.recency+'。保全候補を無印・自動除外・自動HEADにしない。反証：'+(pv.warning||'保存範囲で未観測（安全の証明ではない）'),'rt-note'));const hr=hrInfo129(h,v);td.append(cell('h4','天照 HR05-NEAR｜'+hr.role),cell('p','対象：1勝クラス以上。過去8走内・同場同面同級・距離±200m・2〜3着・0.5秒以内。自動HEAD禁止。'+(hr.z.reason?' '+hr.z.reason:''),'rt-note'));
for(const x of hr.z.hits)td.append(cell('p',x.date+' '+x.racecourse+x.surface+x.distance_m+'m '+x.class_name+' '+x.finish_position+'着 '+x.margin_sec+'秒差','rt-note'));
const route=route128(h);td.append(cell('h4','取捨監査｜'+route.label),cell('p',route.reason,'rt-note'));if(route.key!=='HOLD'){td.append(cell('p','保存P・WIN点灯：'+(route.flags.join('・')||'観測なし')+'／保留：'+(route.pending.join('・')||'なし'),'rt-note'),cell('p','反証・留保：'+(route.warning||'保存範囲で未観測（安全の証明ではない）'),'rt-note'));}const pr=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])),need=price128(pr);if(need!==null)td.append(cell('p','単勝 '+pr.win.toFixed(1)+'倍の損益分岐勝率 '+need.toFixed(2)+'%。払戻倍率の逆数であり、この馬の予測勝率・期待値ではない。','rt-note'));const cross125detail=cross125(h,v);td.append(cell('h4','横断候補の根拠（参考）'));for(const [label,arr] of [['能力',cross125detail.ability],['調教',cross125detail.training],['巻き返し',cross125detail.review],['市場',cross125detail.market]])td.append(cell('p',label+'：'+(arr.join('／')||'陽性観測なし・未確認含む'),'rt-note'));td.append(cell('p','重複は好材料の併存であって、勝率・期待値・正式採用判定ではありません。','rt-note'),cell('h4','調教・展開・注意'));
const a=v.f103.data,b=v.f105.data,p=v.f106.data,f=v.f94.data,x=currentCross(h);
const sr=saved127(h);td.append(cell('h4','保存研究｜展開・好走・凡走反証'));
if(!sr.ok)td.append(cell('p','HOLD：'+sr.reason,'rt-note'));
else{const f=sr.fields;const pairs=[['展開参考役割','V5_展開参考役割'],['脚質参考','V5_脚質proxy'],['先行して粘った実走','V5_前方維持証拠'],['先行して後退した実走','V5_前方後退証拠'],['中団から押し上げた実走','V5_中団証拠'],['後方から押し上げた実走','V5_後方証拠'],['近条件の好凡走','V7_参考判定'],['能力根拠','V10_能力根拠群'],['調教根拠','V10_調教根拠群'],['現級接戦','V10_現級接戦実走明細'],['近条件接戦','V10_近条件接戦実走明細'],['近条件凡走','V10_近条件凡走明細'],['反証・留保','V10_反証留保'],['再監査区分','V10_役割再監査区分'],['前走調教変化','V8_前走調教変化'],['前走SDI参考（正式疲労と別）','V9_前走SDI参考_pct'],['現在の騎手の好走記憶','V16_現騎手3内数'],['血統判断','V16_血統判断'],['厩舎工程正式','V16_厩舎工程正式'],['市場前ルート','V15_市場前ルート']];
for(const [label,k] of pairs)td.append(cell('p',label+'：'+(f[k]??'未確認'),'rt-note'));
const more=document.createElement('details');more.append(cell('summary','保存研究の全項目（監査用）'));
for(const n of [5,6,7,8,9,10,11,12,13,14,15,16]){const g=document.createElement('details');g.append(cell('summary','V'+n+' '+({5:'展開',6:'好走アンカー',7:'好凡走',8:'調教比較',9:'状態観測',10:'領域監査',11:'旧研究接続（安井は旧値）',12:'建御雷部分',13:'救済研究',14:'DIRECT',15:'P・WIN',16:'騎手・厩舎・血統'}[n]||'')));for(const [k,value] of Object.entries(f).filter(([k])=>k.startsWith('V'+n+'_')))g.append(cell('p',k.slice(k.indexOf('_')+1)+'：'+value,'rt-note'));more.append(g);}td.append(more,cell('p',sr.scope+' SOURCE：'+sr.source,'rt-note'));}

const pp=paceRows.get(Number(h[0]));if(pp)td.append(cell('p','同芝ダ・同距離の位置取り：収録 '+pp.same+'走、通過順有効 '+pp.valid+'走／先頭 '+pp.lead+'回、上位1/3 '+pp.front+'回、後方1/3 '+pp.deep+'回／4角比較 '+pp.lateCount+'走、進出 '+pp.gain+'回、先行→着順後退 '+pp.fade+'回。過去の事実であり今回の展開得点ではない。','rt-note'));
const factLines=[['過去10走の好材料',a?a.observations.join('／')||'観測なし':'HOLD：'+v.f103.error],['条件変更',b?[b.movement,b.clazz,...b.tips].join('／'):'HOLD：'+v.f105.error],['位置取り',p?p.note.join('／')||'観測なし':'HOLD：'+v.f106.error],['連戦・休養（疲労指数とは別）',f?'14日以内 '+f.short+'/'+f.gaps.length+'回・今回間隔 '+(f.startGap??'不明')+'日':'HOLD：'+v.f94.error],['調教横断',x?[x.goldLabel,x.scoutLabel,x.rawText].join('\n'):'未照合'],['資料不足',x?x.missing.join('／')||'直前監査待ち':'横断SOURCE未確認']];
for(const [label,val] of factLines)td.append(cell('p',label+'：'+val,'rt-note'));
const y=v.yasui;td.append(cell('h4','安井式 V1.0｜独立能力計算（参考）'));if(y&&!y.error){td.append(cell('p','公式ラップ照合 '+y.matched+'/'+y.history+'走｜未照合 '+y.missing+'走｜全歴 '+(y.complete?'収録確認':'未確定'),'rt-note'));for(const [k,label] of [['stamina','スタミナ'],['speed','スピード'],['power','パワー']])td.append(cell('p',label+'：'+(y[k]?y[k].value.toFixed(2)+'秒／'+(y[k+'Rank']==null?'比較不可（1頭のみ）':'参考順位 '+y[k+'Rank']+'/'+y[k+'N'])+'／根拠 '+y[k].date:y.reasons?.[k]||'未照合')+(y[k+'Other']?'／別面参考 '+y[k+'Other'].value.toFixed(2)+'秒（順位対象外）':''),'rt-note'));td.append(cell('p',y.status+'。参考順位を最終印に使わない。','rt-note'));}else td.append(cell('p','HOLD：'+(y?.error||'計算モジュール未接続'),'rt-note'));
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
const p152=provisional152(r,item.data.past_fields,savedCross150,courseAudit146.course),displayRecords=mode==='暫定印'?p152.order.map(no=>records.find(x=>Number(x.h[0])===no)).filter(Boolean):records;
table.replaceChildren();const hd=document.createElement('thead'),hr=document.createElement('tr');
table.style.minWidth=mode==='調教'?'530px':'0';
const cols=mode==='暫定印'?['馬番','馬名','参考印','勝ち／馬券内順位','根拠・留保']:mode==='市場乖離'?['馬番','馬名','単複・人気','安井GAP※','役割・条件']:mode==='実戦比較'?['馬番','馬名','能力・単勝','勝ち型・調教・展開','役割・反証']:mode==='安井総合'?['馬番','馬名','総合参考順位','能力充足率','3軸参考順位']:mode==='安井原本照合'?['馬番','馬名','スタミナ','スピード','パワー']:mode==='勝ち役割'?['馬番','馬名','WIN馬柱型','P9・安井※','役割再監査']:mode==='候補保全'?['馬番','馬名','保全状態','根拠・市場','役割監査']:mode==='天照HR05'?['馬番','馬名','HR05','E3','再監査役割']:mode==='取捨監査'?['馬番','馬名','研究ルート','単勝・必要率','反証・留保']:mode==='実走反証'?['馬番','馬名','展開参考','再監査区分','反証・留保']:mode==='横断候補'?['馬番','馬名','能力材料','調教候補','巻返し・市場']:mode==='安井式'?['馬番','馬名','スタミナ','スピード','パワー']:mode==='調教候補'?['馬番','馬名','黄金※','双子※','前走比※']:mode==='独自研究'?['馬番','馬名','E3能力','E3穴','LATE7R']:mode==='見直し'?['馬番','馬名','同条件','見直し','過去穴']:mode==='市場'?['馬番','馬名','単勝','複上限','単×複']:mode==='総合'?['馬番','馬名','安井式※','調教※','好材料']:mode==='能力'?['馬番','馬名','3着内','同距離','0.8秒内']:mode==='調教'?['馬番','馬名','ウッド4F','終い1F','黄金／双子']:['馬番','馬名','同距離位置','直近同条件','進出・後退'];
for(const text of cols)hr.append(cell('th',text));hd.append(hr);table.append(hd);const body=document.createElement('tbody');
for(const {h,v} of displayRecords){const row=document.createElement('tr');row.className='rt-row';row.setAttribute('aria-expanded',String(openHorse===h[0]));row.title=h[1]+'の詳細を表示';
const nb=appendData(row,h[0]);nb.className='rt-num';
const name=appendData(row,h[1]+' ▾');name.className='rt-horse';
if(mode==='暫定印'){const p=p152.out.get(Number(h[0]));const x=cell('strong',p?.mark||'—');x.style.fontSize='18px';appendData(row,x);appendData(row,Number.isFinite(p?.win)?'勝 '+p.winRank+'位／内 '+p.placeRank+'位':'HOLD');const d=document.createElement('span');if(Number.isFinite(p?.win)){d.append(cell('div',p.reason),cell('div','勝 '+p.win.toFixed(1)+'点／内 '+p.place.toFixed(1)+'点'),cell('div','能力重み '+p.axis+'/'+p.total));if(p.warning)d.append(cell('div','⚠ '+p.warning));}else d.append(cell('div',p?.reason||p152.reason));appendData(row,d);}
if(mode==='市場乖離'){const g=gapInfo151(h,v),p=rolesInfo148(h,v),a=document.createElement('span');if(g.row){a.append(cell('div',g.row.win.toFixed(1)+'倍／'+(g.row.popularity??'同率')+'人気'),cell('div','複 '+g.row.placeLower.toFixed(1)+'–'+g.row.place.toFixed(1)+'倍'),cell('div','単必要 '+g.row.requiredWin.toFixed(1)+'%'));}else a.append(cell('div','市場HOLD'));appendData(row,a);const q=document.createElement('span');q.append(cell('div',g.status));if(g.delta!=null)q.append(cell('div','差 '+(g.delta>0?'+':'')+g.delta));appendData(row,q);appendData(row,[p.role,...g.context,g.review?'GAP＋条件再監査※':''].filter(Boolean).join('／'));}
if(mode==='実戦比較'){const z=compareInfo147(h,v),p=rolesInfo148(h,v);const a=document.createElement('span');a.append(cell('div',z.ability));const g151=gapInfo151(h,v);if(g151.row){a.append(cell('div','実単 '+g151.row.win.toFixed(1)+'倍／必要 '+g151.row.requiredWin.toFixed(1)+'%'));if(g151.delta!=null)a.append(cell('div','GAP '+(g151.delta>0?'+':'')+g151.delta+'※'));}else a.append(cell('div','発走前市場HOLD'));appendData(row,a);const b=document.createElement('span');for(const line of [z.wins.join('・'),z.p9?'P9保全':'',z.training.join('・'),z.pace])if(line)b.append(cell('div',line));appendData(row,b);const c=document.createElement('span');c.append(cell('div',p.role));if(z.labels.length)c.append(cell('div',z.labels.join('・')));if(p.flip)c.append(cell('div','FLIP再照合※'));if(z.warning)c.append(cell('div','⚠ '+z.warning));const ref=savedCross150(h);if(ref){if(ref.横断再監査タグ)c.append(cell('div','保存横断※ '+ref.横断再監査タグ));b.append(cell('div','主ルート※ '+ref.主ルート実績),cell('div','間隔 '+(ref.間隔日||'不明')+'日'));}appendData(row,c);}
if(mode==='総合'){
 const y=v.yasui,cap=document.createElement('span');for(const [k,label] of [['stamina','持'],['speed','速'],['power','力']])cap.append(cell('div',label+' '+(y?.[k]?(y[k+'Rank']==null?'比較不可':y[k+'Rank']+'/'+y[k+'N']+'位'):'—')));appendData(row,cap);
 const trn=document.createElement('span');if(v.goldFlag||v.ref120?.gold_types?.length)trn.append(tag('黄金※','rt-gold'));if(v.twinFlag||v.ref120?.twin?.session5_strict_accel_saved===true||v.ref120?.twin?.top5_test===true)trn.append(tag('双子※','rt-twin'));appendData(row,trn.childNodes.length?trn:'—');
 const signals=document.createElement('span'),a=v.f103.data,m=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])),im=independentMarket(v);
 if(a&&v.history)signals.append(cell('div','近5走③ '+a.top5+'回'));
 if(v.independent?.E3===true)signals.append(cell('div','E3※'));
 if(im?.LATE7R===true)signals.append(cell('div','LATE7R※'));
 if(m?.cross)signals.append(cell('div','メジアン'));
 if(recovery(v).length)signals.append(cell('div','巻返し材料'));
 appendData(row,signals.childNodes.length?signals:'—');
}
if(mode==='横断候補'){const x=cross125(h,v);const stack=(labels,fallback)=>{if(!labels.length)return fallback;const el=document.createElement('span');for(const l of labels)el.append(cell('div',l));return el;};const y=v.yasui,axes=[['stamina','持'],['speed','速'],['power','力']].filter(([k])=>y?.[k+'Rank']!=null&&y[k+'Rank']<=3).map(([k,label])=>label+y[k+'Rank']+'/'+y[k+'N']+'位');const z=v.ref120,t=z?.twin,train=!!(z?.gold_types?.length||t?.top5_test===true||t?.session5_strict_accel_saved===true);const extra=axes.length?['安井参考 '+axes.join('・')]:[];if(axes.length>=2&&train)extra.push('2軸以上×調教※');appendData(row,stack([...extra,...x.ability],v.history?'該当観測なし':'走歴なし'));appendData(row,stack(x.training,v.raw119?.wood_rows||v.raw119?.hill_rows?'正式判定保留':'未確認'));appendData(row,stack([...x.review,...x.market],x.marketObserved?'該当観測なし':'市場未照合'));}
if(mode==='天照HR05'){const t=hrInfo129(h,v);appendData(row,t.z.state==='YES'?'○ '+t.z.hits.length+'走':t.z.state==='NO'?'×':t.z.state==='OUT'?'対象外':'HOLD');appendData(row,flagText(v.independent?.E3));appendData(row,t.role);}
if(mode==='勝ち役割'){const z=winInfo131(h,v);const sw=sourceWinInfo132(h,v),wb=document.createElement('span');wb.append(cell('div',z.wins.join('・')||'—'));if(sw.signals.length)wb.append(cell('div',sw.signals.join('・')+'（原本参考）'));appendData(row,wb);const a=document.createElement('span');a.append(cell('div','P9 '+flagText(z.p9)));if(z.ref07===true)a.append(cell('div','2軸＋首位※'));appendData(row,a);const q=document.createElement('span');q.append(cell('div',z.state));if(z.p9===true)q.append(cell('div',z.flip));appendData(row,q);}
if(mode==='候補保全'){const z=preserveInfo130(h,v);appendData(row,z.state);const el=document.createElement('span');for(const t of [...z.ability,...z.other,...z.route])el.append(cell('div',t));el.append(cell('div',z.deep));appendData(row,el);appendData(row,z.state==='PRESERVED-WATCH'?'役割HOLD'+(z.warning?' ⚠':''):z.warning||'監査継続');}
if(mode==='取捨監査'){const z=route128(h),mr=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0])),rate=price128(mr);const box=document.createElement('span');box.append(cell('div',z.label));const hr=hrInfo129(h,v);if(hr.z.state==='YES')box.append(cell('div',hr.role));if(z.flags.length)box.append(cell('div',z.flags.join('・')));appendData(row,box);appendData(row,rate===null?'市場未照合':mr.win.toFixed(1)+'倍 / '+rate.toFixed(1)+'%※');appendData(row,z.key==='HOLD'?z.reason:z.warning||'未観測・確認継続');}
if(mode==='実走反証'){const z=saved127(h),f=z.fields;appendData(row,z.ok?f['V5_展開参考役割']||'未確認':'HOLD');appendData(row,z.ok?f['V10_役割再監査区分']||'未確認':z.reason);appendData(row,z.ok?(f['V10_反証留保']||'保存範囲で未観測'):'再照合待ち');}
if(mode==='能力'){appendData(row,valid(v.top3)?v.top3+'回':'—');appendData(row,valid(v.same)?v.same+'走':'—');appendData(row,valid(v.near)?v.near+'回':'—');}
if(mode==='調教'){const raw=v.raw119?.wood_fastest_4f;appendData(row,v.wood?Number(v.wood['4F']).toFixed(1):raw?raw['4F']+'※':'—');appendData(row,v.wood?Number(v.wood['1F']).toFixed(1):raw?raw['1F']+'※':'—');const tags=document.createElement('span');if(v.goldFlag)tags.append(tag(v.gold.length+'型','rt-gold'));if(v.twinFlag){if(tags.childNodes.length)tags.append(' ');tags.append(tag('双子※','rt-twin'));}appendData(row,tags.childNodes.length?tags:'—');}
if(mode==='調教候補'){const z=v.ref120;appendData(row,z?.gold_coverage?(z.gold_types.length?tag((z.dual_sust_same_session?'D+S ':'')+z.gold_types.length+'型','rt-gold'):'観測なし'):'未確認');appendData(row,z?.twin?.session5_strict_accel_saved===true?tag('S5候補','rt-twin'):z?.twin?.top5_test===true?tag('上位5%','rt-twin'):z?.twin?.raw_matched?'候補外':'未確認');appendData(row,z?.both_improved===true?tag('両改善','rt-gold'):z?.previous_comparison?.length?'比較あり':'未確認');}
if(mode==='安井総合'){const q=courseAudit146.out.get(Number(h[0])),y=v.yasui;appendData(row,q?q.rank+'位※ / '+q.score.toFixed(4):courseAudit146.course.ok?'算出不可・別枠':'★HOLD');appendData(row,q?(q.coverage*100).toFixed(1)+'%（軸のみ）':'—');appendData(row,['stamina','speed','power'].map((k,i)=>['持','速','力'][i]+' '+(y?.sourceRanks?.[k]?.rank??'—')).join('／'));}
if(mode==='安井原本照合'){const y=v.yasui;for(const k of ['stamina','speed','power']){const a=y?.sourceValues?.[k],q=y?.sourceRanks?.[k],c=y?.sourceCoverage?.[k],el=document.createElement('span');el.append(cell('div',a&&q?a.value.toFixed(2)+' / '+q.rank+'/'+q.n+'位※':'未照合'));if(a)el.append(cell('div',y.sourceBasis[k]));if(c)el.append(cell('div','同面有効 '+c.usable+'/'+c.required+'走'));appendData(row,el);}}
if(mode==='安井式'){const y=v.yasui;for(const k of ['stamina','speed','power'])appendData(row,y?.[k]?y[k].value.toFixed(2)+(y[k+'Rank']==null?' / 比較不可':' / '+y[k+'Rank']+'/'+y[k+'N']+'位※'):y?.[k+'Other']?y[k+'Other'].value.toFixed(2)+' 別面※':y?.reasons?.[k]||'未照合');}
if(mode==='独自研究'){const z=v.independent,q=independentMarket(v);appendData(row,flagText(z?.E3));appendData(row,flagText(q?.E3hole));appendData(row,flagText(q?.LATE7R));}
if(mode==='見直し'){const a=v.f103.data,b=v.f105.data,p=v.f106.data;appendData(row,a&&v.history?a.goodSame+'/'+a.sameDist:'未確認');const flags=recovery(v);appendData(row,flags.length?flags.join('・'):b&&p&&v.history?'なし':'未確認');appendData(row,a&&v.history&&h[8].some(p=>valid(p[ix.past_win_odds]))?a.outsider+'回':'未確認');}
if(mode==='市場'){const a=currentMarket()?.single?.rows.find(x=>x.no===Number(h[0]));appendData(row,a?a.win.toFixed(1):'—');appendData(row,a?a.place.toFixed(1):'—');appendData(row,a?(a.cross?tag('重複','rt-gold'):'—'):'未取得');}
if(mode==='展開'){const p=paceRows.get(Number(h[0]));appendData(row,p?.valid?'先行 '+p.front+'/'+p.valid+'\n後方 '+p.deep+'/'+p.valid:'未観測');appendData(row,p?.latest?'前方位置 '+p.latest.early+'/'+p.latest.size+'\n'+p.latest.corner+'角':'未観測');appendData(row,p?.lateCount?'進出 '+p.gain+'/'+p.lateCount+'\n先行後退 '+p.fade+'/'+p.lateCount:'未観測');}
row.addEventListener('click',()=>{openHorse=openHorse===h[0]?null:h[0];draw();});body.append(row);
if(openHorse===h[0])body.append(extended(h,v));
}
table.append(body);status.textContent='全'+hh.length+'頭を1頭1行で表示｜'+mode+(mode==='暫定印'?'｜◎=勝ち点首位、○▲=残りの馬券内点順、△=相手。着順確率ではない。算出 '+[...p152.out.values()].filter(x=>Number.isFinite(x.win)).length+'/'+hh.length+'頭。能力40・実走40・役割10・調教10の未検証仮配点。正式印・購入HOLD。':'')+'｜行を押すと過去走・根拠を開閉'+(mode==='安井式'?'｜同面算出：持 '+ys.filter(x=>x?.stamina).length+'/'+hh.length+'・速 '+ys.filter(x=>x?.speed).length+'/'+hh.length+'・力 '+ys.filter(x=>x?.power).length+'/'+hh.length+'｜順位は算出可能馬のみ。別面は参考値。':'')+(mode==='横断候補'?'｜安井上位3位は探索用の参考順位（算出可能馬内）。2軸以上×調教は保存済み候補との重複。正式MULTI・印ではない。':'')+(mode==='調教候補'?'｜※保存研究の参考候補。D+Sは同一調教。S5は保存候補。前走比は4F・1F。正式判定HOLD。':'');
btns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));otherSelect.value=primaryModes.includes(mode)?'':mode;otherSelect.setAttribute('aria-label','その他の研究：'+(primaryModes.includes(mode)?'選択':mode));
}
const primaryModes=['暫定印','実戦比較','総合','安井総合','調教','市場'];tabs.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';
for(const m of primaryModes){const b=cell('button',m==='総合'?'全頭一覧':m);b.type='button';b.dataset.mode=m;b.addEventListener('click',()=>{mode=preferredMode=m;openHorse=null;draw();});tabs.append(b);btns.push(b);}
const otherSelect=document.createElement('select');otherSelect.className='rt-research-select';option(otherSelect,'','その他の研究を選ぶ ▾');for(const m of modes.filter(x=>!primaryModes.includes(x)))option(otherSelect,m,m);otherSelect.addEventListener('change',()=>{if(otherSelect.value){mode=preferredMode=otherSelect.value;openHorse=null;draw();}});
const summaryBar=document.createElement('div');summaryBar.className='rt-brief';const quickMarket=document.createElement('span');const quickCoverage=document.createElement('span');summaryBar.append(quickMarket,quickCoverage);
function compactSummary(){const m=currentMarket(),gate=m?.favoriteGate?.gates.filter(x=>x.match===true).map(x=>x.name);quickMarket.textContent='市場：'+(gate?.length?gate.join('・')+'（参考）':m?.single?'照合済／荒れ判定保留':'オッズ未照合');quickCoverage.textContent='買い目保留｜10走収録 '+records.filter(x=>x.v.history===10).length+'/'+hh.length+'頭';}
const racePanel=document.createElement('details');racePanel.className='rt-fold';racePanel.open=true;
function renderRacePanel(){
 const fav=favorite126(currentMarket(),records);
 const labels=fav.favorite?fav.gates.filter(g=>g.match===true).map(g=>g.name):[];
 racePanel.replaceChildren(cell('summary','1番人気・展開監査｜'+(labels.join(' / ')||fav.status)));
 if(fav.favorite){const {h,v}=fav.favorite,x=cross125(h,v);racePanel.append(cell('div',h[0]+'番 '+h[1]+' '+fav.odds.toFixed(1)+'倍（入力時点）'));
 for(const g of fav.gates.filter(g=>g.match===true)){racePanel.append(cell('div',g.name+'｜過去'+g.stats[0]+'R：1着 '+g.stats[1]+'%／2–3着 '+g.stats[2]+'%／圏外 '+g.stats[3]+'%'));}
 const unknown=fav.gates.filter(g=>g.match===null).map(g=>g.name);if(unknown.length)racePanel.append(cell('div','未判定：'+unknown.join('・')));
 racePanel.append(cell('div','1人気の能力・調教材料：'+([...x.ability,...x.training].join('・')||'陽性観測なし／未確認')));
 const alternatives=records.filter(y=>{if(y===fav.favorite)return false;const z=cross125(y.h,y.v);return z.abilityTraining||z.recoveryTraining||z.market.length>0;}).map(y=>({no:y.h[0],name:y.h[1],rank:fav.rank(y.h[0])}));
 racePanel.append(cell('div','他馬の横断・市場候補：'+(alternatives.map(x=>x.no+' '+x.name+'（'+(x.rank==null?'人気同率':x.rank+'人気')+'）').join('・')||'陽性観測なし')));
 }else racePanel.append(cell('div',fav.status+'。人気別の判断はしない。'));
 const saved=saved127Race(item);if(saved.ok){const f=saved.fields;racePanel.append(cell('div','保存前圧参考 '+f['V5_前圧参考']+'｜欠測感度 '+(f['欠測感度安定']==='YES'?'安定（参考）':'不安定・HOLD')+'｜位置確認 '+f['位置確認馬']+'/'+hh.length+'頭'));}else racePanel.append(cell('div','保存前圧：HOLD／'+saved.reason));
const all=records.map(({h})=>({h,p:paceRows.get(Number(h[0]))}));
 const eligible=all.filter(x=>x.p?.valid>0);
 const front=eligible.filter(x=>x.p.latest.front).map(x=>x.h[0]+'番'),deep=eligible.filter(x=>x.p.latest.deep).map(x=>x.h[0]+'番');
 racePanel.append(cell('div','展開観測：同芝ダ・同距離で有効な位置取り '+eligible.length+'/'+hh.length+'頭'));
 racePanel.append(cell('div','直近の同条件走：前方 '+(front.join('・')||'観測なし')+'／後方 '+(deep.join('・')||'観測なし')));
 const btn=cell('button','全頭の展開根拠を見る');btn.type='button';btn.style.cssText='font-size:12px;padding:7px;margin:4px 0';btn.addEventListener('click',()=>{mode=preferredMode='展開';openHorse=null;draw();});racePanel.append(btn,cell('p','SAFE/FLYは3,450Rの独立ゲート実測。重複を加算しない。今回の勝率ではない。展開は過去の最初に記録された角の位置（上位・下位1/3）で、先行争い・恩恵の正式予測はHOLD。','rt-foot'));
}
const crossPanel=document.createElement('div');crossPanel.className='rt-brief';crossPanel.style.cssText='display:block;padding:9px;margin:6px 0;background:#19364a;border-radius:8px;font-size:12px';
function renderCrossPanel(){crossPanel.replaceChildren(cell('strong','横断候補｜買い目HOLD'));const all=records.map(({h,v})=>({h,x:cross125(h,v)}));for(const [label,select] of [['能力＋調教',x=>x.abilityTraining],['巻返し＋調教',x=>x.recoveryTraining],['能力＋市場参考',x=>x.ability.length&&x.market.length]]){const list=all.filter(y=>select(y.x)).map(y=>y.h[0]+' '+y.h[1]);crossPanel.append(cell('div',label+'：'+(list.join('・')||'陽性観測なし／未確認含む')));}const btn=cell('button','全頭の横断根拠を見る');btn.type='button';btn.style.cssText='font-size:12px;padding:7px;margin:4px 0 0';btn.addEventListener('click',()=>{mode=preferredMode='横断候補';openHorse=null;draw();});crossPanel.append(btn,cell('div','※候補の併存を表示。点数化・順位付けなし。市場は入力時点の参考。'));} 
const reviewPanel=document.createElement('details');reviewPanel.className='rt-fold';reviewPanel.open=false;
function renderReview127(){const saved=records.map(({h})=>({h,z:saved127(h)})),ok=saved.filter(x=>x.z.ok);reviewPanel.replaceChildren(cell('summary','保存研究・反証｜'+ok.length+'/'+hh.length+'頭'));const roles=['能力＋展開再監査','能力＋調教再監査','能力証拠保全','調教観測・能力要確認'];
for(const label of roles){const names=ok.filter(x=>x.z.fields['V10_役割再監査区分']===label).map(x=>x.h[0]+'番');if(names.length)reviewPanel.append(cell('div',label+'：'+names.join('・')));}
const warned=ok.filter(x=>x.z.fields['V5_展開参考役割']==='前崩れ注意WATCH').map(x=>x.h[0]+'番');if(warned.length)reviewPanel.append(cell('div','前崩れ注意WATCH：'+warned.join('・')));
const missing=saved.filter(x=>!x.z.ok).map(x=>x.h[0]+'番');if(missing.length)reviewPanel.append(cell('div','未収録・HOLD：'+missing.join('・')));
reviewPanel.append(cell('p','保存済み観測の再表示。正式な予想印・展開実現性・期待値は未確定。','rt-foot'));const btn=cell('button','全頭の好走・凡走反証を見る');btn.type='button';btn.style.cssText='font-size:12px;padding:7px;margin:4px 0';btn.addEventListener('click',()=>{mode=preferredMode='実走反証';openHorse=null;draw()});reviewPanel.append(btn);}
const decisionPanel=document.createElement('div');decisionPanel.className='rt-brief';decisionPanel.style.cssText='display:block;padding:10px;margin:6px 0;background:#19364a;border:1px solid #4c697d;border-radius:9px;font-size:12px';
function renderDecision128(){const all=records.map(({h})=>({h,z:route128(h)}));decisionPanel.replaceChildren(cell('strong','取捨監査｜最終購入HOLD'));for(const [key,label] of [['勝ち型WATCH','勝ち型WATCH'],['穴型保全_市場待ち','穴型（市場待ち）'],['PLACE再監査_P9','複勝型（P9）'],['勝ち切り再監査_馬柱のみ','馬柱WIN再監査']]){const group=all.filter(x=>x.z.key===key);const nums=group.map(x=>x.h[0]+'番'+(x.z.warning?'⚠':'')).join('・');decisionPanel.append(cell('div',label+'：'+(nums||'保存陽性なし')));}
const missing=all.filter(x=>x.z.key==='HOLD');if(missing.length)decisionPanel.append(cell('div','研究未照合：'+missing.map(x=>x.h[0]+'番').join('・')));
const m=currentMarket();decisionPanel.append(cell('div',m?.single?'市場入力あり（時刻・発走前採用監査は別）':'市場未照合：穴・過小評価の確定不可'),cell('div','⚠＝保存反証・留保あり。予想印ではない。正式勝率・期待値が未確定のため購入額は算出しない。'));
const btn=cell('button','全頭の取捨根拠を見る');btn.type='button';btn.style.cssText='font-size:12px;padding:7px;margin:4px 0 0';btn.addEventListener('click',()=>{mode=preferredMode='取捨監査';openHorse=null;draw();});decisionPanel.append(btn);}
const longPanel=document.createElement('details');longPanel.className='rt-fold';
function renderLong129(){const all=records.map(({h,v})=>({h,...hrInfo129(h,v)}));const yes=all.filter(x=>x.z.state==='YES'),strong=yes.filter(x=>x.role==='STRONG-RECHECK');longPanel.replaceChildren(cell('summary','天照再監査・長期検証｜HR05 '+yes.length+'頭'));
longPanel.append(cell('div','HR05：'+(yes.map(x=>x.h[0]+'番').join('・')||'陽性観測なし')+'／重複STRONG：'+(strong.map(x=>x.h[0]+'番').join('・')||'なし')+'／資料HOLD '+all.filter(x=>x.z.state==='HOLD').length+'頭'));
const btn=cell('button','全頭HR05の根拠を見る');btn.type='button';btn.style.cssText='font-size:12px;padding:7px;margin:4px 0';btn.addEventListener('click',()=>{mode=preferredMode='天照HR05';openHorse=null;draw()});longPanel.append(btn);
const t=document.createElement('table');const hd=document.createElement('tr');for(const x of ['保存研究（条件付き）','2017–23 3着内','2024–26 3着内'])hd.append(cell('th',x));t.append(hd);
for(const a of [['E3・7人気以下','14.03% / 4482頭','14.06% / 3038頭'],['LATE-7R','22.96% / 135頭','24.21% / 95頭'],['HR05・7人気以下','12.80% / 3163頭','12.71% / 2187頭'],['HR05＋E3・7人気以下','15.45%','15.60%'],['安井SPEED上位3','35.22% / 52415頭','35.88% / 25520頭']]){const tr=document.createElement('tr');for(const x of a)tr.append(cell('td',x));t.append(tr);}longPanel.append(t,cell('p','黄金DUAL 11/14–15：31頭5勝15複勝圏、単勝74.2%・複勝99.7%。近5走3着内2回以上16頭の探索結果は単143.75%・複140.0%、最高単勝払戻馬除外で単70.7%。独立OOS未検証。','rt-note'),cell('p','SOURCE：50CSV_4モデル強化監査_V0.1、AMATERASU_HEAD_RECHECK_V020_50CSV_CALIBRATED、AMATERASU_HEAD_MARKET_RECOVERY_V013、20261121_DUAL31頭_単複100円払戻検算、20261121_黄金DUAL31頭_過去10走能力因子_実測比較。母集団は異なる。今回の勝率に転用しない。単複ROI未収録の研究は不明。','rt-foot'));}
const preservePanel=document.createElement('details');preservePanel.className='rt-fold';
function renderPreserve130(){const all=records.map(({h,v})=>({h,z:preserveInfo130(h,v)})),yes=all.filter(x=>x.z.state==='PRESERVED-WATCH'),hold=all.filter(x=>x.z.state==='照合HOLD'||x.z.state==='資料HOLD');preservePanel.replaceChildren(cell('summary','候補保全・最終圧縮監査｜'+yes.length+'/'+hh.length+'頭'));
preservePanel.append(cell('div','保全WATCH：'+(yes.map(x=>x.h[0]+'番').join('・')||'陽性観測なし／未確認含む')),cell('div','DEEP再監査対象：'+(yes.filter(x=>x.z.deep.startsWith('DEEP')).map(x=>x.h[0]+'番').join('・')||'陽性観測なし／市場未確認含む')),cell('div','資料HOLD：'+(hold.map(x=>x.h[0]+'番').join('・')||'なし')+'｜別枠 '+all.filter(x=>x.z.state==='別枠').length+'頭'));
const btn=cell('button','全頭の保全理由・役割を確認');btn.type='button';btn.style.cssText='font-size:12px;padding:7px;margin:4px 0';btn.addEventListener('click',()=>{mode=preferredMode='候補保全';openHorse=null;draw()});preservePanel.append(btn,cell('p','NO-SILENT-DROP V0.10／LAST-MILE ROLE GATE V0.10／CROSS-VENUE ROUTER V0.10。接続済み研究の候補保全のみ。正式PROTECTED全センサー・最新走・H1/H2/H3・現HEAD比較・独立反証2領域・最終印・発走前固定は未完了。購入HOLD。','rt-foot'));}
const winPanel=document.createElement('details');winPanel.className='rt-fold';
function renderWin131(){const all=records.map(({h,v})=>({h,z:winInfo131(h,v)}));const p9=all.filter(x=>x.z.p9===true),w=all.filter(x=>x.z.wins.length>0),ref=p9.filter(x=>x.z.ref07===true);
winPanel.replaceChildren(cell('summary','勝ち役割｜WIN点灯 '+w.length+'頭・P9 '+p9.length+'頭'));
const names=xs=>xs.map(x=>x.h[0]+'番').join('・')||'観測なし';
winPanel.append(cell('div','WIN馬柱型：'+names(w)),cell('div','P9（複勝・3着保全）：'+names(p9)),cell('div','P9＋参考2軸首位：'+names(ref)+'（正式WIN07ではない）'),cell('div','P9のWIN07正式未確定：'+names(p9.filter(x=>x.z.formal07==null))));
const b=cell('button','全頭の勝ち役割・複勝保全を見る');b.type='button';b.style.cssText='font-size:12px;padding:7px;margin:4px 0';b.addEventListener('click',()=>{mode=preferredMode='勝ち役割';openHorse=null;draw()});winPanel.append(b);
const t=document.createElement('table');for(const a of [['研究','対象','勝率','単勝近似回収'],['P9＋WIN07 DEV','171','7.60%','149.65%'],['P9＋WIN07 OOS','107','7.48%','122.34%'],['P9のみ OOS※','1951','2.20%','64.26%'],['P9＋WIN07 2026年3–6月','16','6.25%','186.88%'],['P9＋WIN07 2026年7–8月','4','0%','0%']]){const tr=document.createElement('tr');for(const x of a)tr.append(cell('td',x));t.append(tr);}winPanel.append(t,cell('p','※P9のみ＝P9 without WIN07。穴帯（6人気以下または15倍以上）の既存検証。DEV 2018–22、OOS 2023–25。回収率は最終単勝オッズによる近似で、実払戻ではない。SOURCE：JRA_WIN_PATTERN_LIBRARY_V010_20260913.md。自動HEAD・自動BETなし。','rt-foot'));}
const sourcePanel=document.createElement('details');sourcePanel.className='rt-fold';
function renderSource132(){const all=records.map(({h,v})=>({h,v,z:sourceWinInfo132(h,v)}));sourcePanel.replaceChildren(cell('summary','安井式コース総合｜正式順位HOLD'));const c=courseAudit146.course;sourcePanel.append(cell('div',c.ok?'書籍転記★：速 '+c.w.speed+'／持 '+c.w.stamina+'／力 '+c.w.power+'｜V0.30 '+c.row[8]:'コース★HOLD：'+c.reason));if(c.shapeSource)sourcePanel.append(cell('div','形態：'+c.shape+'（'+c.shapeSource+'）'));if(c.ok){const ranked=[...courseAudit146.out.entries()].sort((a,b)=>a[1].rank-b[1].rank);sourcePanel.append(cell('div','総合参考上位：'+(ranked.filter(x=>x[1].rank<=3).map(([no,q])=>no+'番 '+q.rank+'位／充足 '+(100*q.coverage).toFixed(1)+'%').join('・')||'算出なし')));const bb=cell('button','全頭のコース総合参考を見る');bb.type='button';bb.style.cssText='font-size:12px;padding:7px;margin:4px 0';bb.addEventListener('click',()=>{mode=preferredMode='安井総合';openHorse=null;draw()});sourcePanel.append(bb,cell('p','V0.30原本：Σ（軸順位×★）÷有効★合計。★0は正規値、欠損軸は分母から除外。能力充足率＝有効★合計÷全★合計。収録資料内の参考順位であり最終印・期待値ではない。','rt-note'));}for(const k of ['stamina','speed','power']){const found=all.filter(x=>x.v.yasui?.sourceValues?.[k]);sourcePanel.append(cell('div',({stamina:'持',speed:'速',power:'力'}[k])+'：参考値 '+found.length+'/'+hh.length+'頭／別面 '+found.filter(x=>x.v.yasui.sourceBasis[k]==='別面参考').length+'頭'));}for(const k of ['WIN06','WIN07','WIN08','WIN09','WIN11','WIN12'])sourcePanel.append(cell('div',k+'参考：'+(all.filter(x=>x.z.signals.includes(k)).map(x=>x.h[0]+'番').join('・')||'未観測・未確認含む')));sourcePanel.append(cell('div','全歴独立確認 '+all.filter(x=>x.v.yasui?.sourceCareerConfirmed).length+'/'+hh.length+'頭。WIN10の正式建御雷判定は別途HOLD。'));const btn=cell('button','全頭の原本方式と資料充足率を見る');btn.type='button';btn.style.cssText='font-size:12px;padding:7px;margin:4px 0';btn.addEventListener('click',()=>{mode=preferredMode='安井原本照合';openHorse=null;draw()});sourcePanel.append(btn,cell('p','SOURCE：yasui_v1_0_engine.py／JRA_WIN_PATTERN_LIBRARY_V010_20260913.md。参考点灯は同じ数式を収録済みラップに適用したもの。正式WINフラグを書き換えない。','rt-foot'));}
const comparePanel=document.createElement('div');comparePanel.className='rt-brief';comparePanel.style.cssText='display:block;padding:8px;margin:6px 0;border:1px solid #4c697d;border-radius:9px;font-size:12px';
function renderCompare147(){
 const all=records.map(({h,v})=>({h,z:compareInfo147(h,v),p:rolesInfo148(h,v)}));
 const list=xs=>xs.map(x=>x.h[0]+'番'+(x.z.warning?'⚠':'')).join('・')||'観測なし／未確認含む';
 const focus=all.filter(x=>x.p.focus);
 comparePanel.replaceChildren(cell('strong','実戦役割再監査｜購入HOLD'),cell('div','横断注目 '+focus.length+'/'+hh.length+'頭（全頭を表に保持）'));
 for(const k of ['勝ち・複勝両方再監査','勝ち切り再監査','複勝・3着再監査','穴型・市場待ち','通常・保全監査']){
  const a=focus.filter(x=>x.p.role===k);if(a.length)comparePanel.append(cell('div',k+'：'+list(a)));
 }
 const add=all.filter(x=>!x.p.focus&&(x.p.win||x.p.place||x.p.hole));
 if(add.length)comparePanel.append(cell('div','横断注目外も既存WIN/P保全 '+add.length+'頭（表で確認）'));
 comparePanel.append(cell('div','正式発券条件未成立。全歴・当日情報・市場・勝率/期待値の未確定を能力不足としない。※必要率＝単勝倍率の逆数。'));
 const details=document.createElement('details');details.append(cell('summary','横断注目の内訳'));
 for(const k of ['上位×WIN','上位×調教','上位×展開','P9×WIN07参考','保存勝ち型WATCH','保存能力＋調教','保存能力＋展開'])details.append(cell('div',k+'：'+list(all.filter(x=>x.z.labels.includes(k)))));
 details.append(cell('div','能力上位＝総合参考3位以内かつ能力軸充足100%。表示用の比較条件で新規買いルールではない。⚠＝保存反証・資料不足。SOURCE：JRA_WIN_PATTERN_LIBRARY_V010_20260913.md／JRA_LAST_MILE_ROLE_GATE_V010_20260914.md。'));
 comparePanel.append(details);
}
const gapPanel151=document.createElement('details');gapPanel151.className='rt-fold';
function renderGap151(){const m=verifiedMarket151(),a=records.map(({h,v})=>({h,g:gapInfo151(h,v,m)}));gapPanel151.replaceChildren(cell('summary','市場乖離｜'+(m.ok?'実オッズ照合済':'HOLD')),cell('div',m.reason+(m.time?'／'+m.time:'')));if(m.ok){const yes=a.filter(x=>x.g.delta>0),ctx=a.filter(x=>x.g.review);gapPanel151.append(cell('div','能力順位が市場より上：'+(yes.map(x=>x.h[0]+'番 +'+x.g.delta).join('・')||'観測なし')),cell('div','既存役割＋条件参考もある馬：'+(ctx.map(x=>x.h[0]+'番').join('・')||'観測なし')),cell('div','比較可能 '+a.filter(x=>x.g.delta!=null).length+'/'+hh.length+'頭。安井総合は参考順位。'));}const b=cell('button','全頭の市場乖離を見る');b.type='button';b.style.cssText='font-size:12px;padding:7px;margin:4px 0';b.addEventListener('click',()=>{mode=preferredMode='市場乖離';openHorse=null;draw()});gapPanel151.append(b,cell('p','GAP＝人気順位−安井総合参考順位。符号表示のみ。正式GAP閾値・CONTEXT/FIT・予測勝率は未確定。未取得・古い・同率オッズを捏造しない。SOURCE：安井式_実計算版_V1.0_仕様書.md。','rt-foot'));}
const shortNote=cell('p','※安井式は照合済み履歴内の参考順位（持＝スタミナ、速＝スピード、力＝パワー）。調教・好材料は候補を含む。馬名を押すと根拠・過去走が開きます。','rt-foot');

dashboard.append(summaryBar,comparePanel,gapPanel151,tabs,otherSelect,status,scroll,shortNote,decisionPanel,winPanel,sourcePanel,preservePanel,racePanel,crossPanel,reviewPanel,longPanel,marketFold,auditNotes);auditNotes.append(cell('p','ウッド4F・終い1Fは同一の主追い日から抽出（馬ID・馬名照合済）。黄金は保存済み4型の一致数。双子※は原点研究の当日上位5%のみで正式V0.21判定ではありません。未取得は「—」。※付きの時計は今週原票の最速4F（正式主追い日判定とは別）。坂路の仮照合は馬の詳細に表示。','rt-foot'));
dashboard.hidden=false;marketRedraw=()=>{compactSummary();marketOverview();auditOverview();renderRacePanel();renderCrossPanel();renderReview127();renderDecision128();renderLong129();renderPreserve130();renderWin131();renderSource132();renderCompare147();renderGap151();draw();};marketRedraw();
}
venue.addEventListener('change',()=>{selection();if(bundle)go.click();});
race.addEventListener('change',()=>{const item=bundle?.races.find(x=>x.data.race.venue===venue.value&&x.data.race.date+'|'+x.data.race.race_no===race.value);if(item)go.click();});
go.addEventListener('click',()=>{
if(!bundle){$('bundleSettings').open=true;return busy('HOLD：統合データ未選択');}
go.disabled=true;
try{
const item=bundle.races.find(x=>x.data.race.venue===venue.value&&x.data.race.date+'|'+x.data.race.race_no===race.value);
if(!item)throw Error('対象レースが統合データにありません');if(!flat147(item.data.race))throw Error('障害・対象外レースは実戦対象外');
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