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
/* V35 additive, factual pre-race horse cards. No scoring, no new research rule. */
const facts=document.createElement('section');facts.id='v35Facts';facts.setAttribute('aria-label','全頭過去走・調教基礎因子');
facts.style.cssText='margin:14px 0;padding:12px;border:1px solid #58708b;border-radius:8px;background:#142234;color:#eef3f8;max-width:100%;overflow:auto';
facts.hidden=true;status.parentElement.append(facts);
function renderFacts(item){
facts.replaceChildren();const r=item.data.race;
const title=document.createElement('h3');title.textContent='V35 過去走×調教：'+r.venue+r.race_no+'R／全'+r.horses.length+'頭';facts.append(title);
const note=document.createElement('p');note.textContent='発走前の実測・履歴のみ。双子／黄金調教の正式判定、勝率、購入判断ではありません。調教の馬ID未検証一致を確定扱いしません。';facts.append(note);
const tbl=document.createElement('table');tbl.style.cssText='border-collapse:collapse;width:100%;font-size:12px;white-space:nowrap';
const names=['馬番','馬名','過去走','同距離','3着内','着差0.8秒以内','前走4角','前走着順','調教','坂路終い1F'];
const tr=document.createElement('tr');for(const n of names){const th=document.createElement('th');th.textContent=n;th.style.cssText='border-bottom:1px solid #58708b;padding:6px;text-align:left';tr.append(th)}tbl.append(tr);
const key=(x,k)=>x?.[k]??'';
for(const h of r.horses){
const m=h[9]||{},a=m.v35_factual_feature_card;
if(!a)continue;
const obs=m.training_20261121||[];let best=null;for(const w of obs)for(const t of w.hill||[]){const v=Number(t.Lap1);if(Number.isFinite(v)&&v>=9&&v<=35)best=best==null?v:Math.min(best,v)}
const vals=[h[0],h[1],key(a,'過去走件数'),key(a,'同距離走数'),key(a,'直近7走3着以内回数'),key(a,'直近7走着差0.8秒以内回数'),key(a,'前走4角'),key(a,'前走着順'),m.training_status==='ID_VERIFIED_WOOD'?'馬ID検証':m.training_status==='NAME_TRAINER_MATCH_ID_UNVERIFIED'?'馬名＋厩舎':'未取得',best==null?'—':best.toFixed(1)];
const row=document.createElement('tr');for(const v of vals){const td=document.createElement('td');td.textContent=String(v===''?'—':v);td.style.cssText='border-bottom:1px solid #304157;padding:5px';row.append(td)}tbl.append(row)
}
facts.append(tbl);
const report=item.v36_race_position_fatigue_summary;
if(report){
const p=document.createElement('p');p.textContent='V36 位置取り候補：前寄り'+report.front_candidate_n+'頭／中団'+report.middle_candidate_n+'頭／後方'+report.rear_candidate_n+'頭／過去位置情報不足'+report.position_insufficient_n+'頭。休み60日以上'+report.rest_60d_plus_n+'頭。これは過去走からの事実分類であり、正式なペース予測ではありません。';facts.insertBefore(p,tbl);
const p2=document.createElement('p');p2.textContent='前寄り候補：'+(report.front_candidate_horses.length?report.front_candidate_horses.map(a=>a[0]+'番 '+a[1]).join('、'):'該当なし／情報不足に注意');facts.append(p2);
}
/* V37 original twin distances are diagnostic: never equate daily rank to V0.21 TT-S. */
const twinSection=document.createElement('div');twinSection.style.cssText='padding:8px 0;margin-top:10px;border-top:1px solid #58708b';
const twinTitle=document.createElement('h4');twinTitle.textContent='V37 双子調教・原点V0.10（当日CSVのみの参考判定）';twinSection.append(twinTitle);
const twinInfo=document.createElement('p');twinInfo.textContent='原点式D=√(0.2ΔL4²+0.5ΔL3²+1.0ΔL2²+1.2ΔL1²)。11/21坂路2024有効セッションの上位101件を参考表示。V0.21 TT-Sや黄金正式型とは異なり、調教の馬ID未検証例を含みます。';twinSection.append(twinInfo);
const twins=r.horses.map(h=>({h,t:h[9]?.v37_twin_origin_v010})).filter(x=>x.t?.best_origin?.top5_uploaded_day_research);
const twinList=document.createElement('p');twinList.textContent=twins.length?twins.map(x=>x.h[0]+'番 '+x.h[1]+'／D='+x.t.best_origin.origin_mean_D.toFixed(3)+'・当日'+x.t.best_origin.full_uploaded_20261121_rank+'位'+(x.t.best_origin.strict_accel?'・連続加速':'・連続加速なし')).join('、'):'該当なし';twinSection.append(twinList);
facts.append(twinSection);
/* WOOD SCOUT V0.10: 4 independent confirmed historical SOURCE rules, source-matched horses only. */
const goldSection=document.createElement('div');goldSection.style.cssText='padding:8px 0;margin-top:10px;border-top:1px solid #58708b';
const gt=document.createElement('h4');gt.textContent='V38 黄金調教4型（WOOD SCOUT V0.10）';goldSection.append(gt);
const gp=document.createElement('p');gp.textContent='11/15・17・18・19・21のウッド原票を同日×場所×回りで比較。4F中央値58秒以内のMAIN_WORKDAYに限定し、保存済みの4型条件を適用。馬ID＋馬名一致のみを確定照合。型該当だけで勝負馬認定はしません。';goldSection.append(gp);
const gMatches=r.horses.map(h=>({h,g:h[9]?.v38_golden_wood_scout_v010})).filter(x=>x.g?.any_golden_v010);
const gl=document.createElement('p');gl.textContent=gMatches.length?gMatches.map(x=>x.h[0]+'番 '+x.h[1]+'：'+Object.keys(x.g.types).filter(k=>x.g.types[k]).join('＋')+' ['+(x.g.strict_id_match?'ID照合':'ID未検証')+']').join('／'):'このレースの黄金4型該当なし（未取得馬はUNKNOWN）';goldSection.append(gl);
facts.append(goldSection);
/* ADD ONLY: V39 GOLDEN x PRE-RACE REAL PERFORMANCE EVIDENCE */
const crossSection=document.createElement('div');crossSection.style.cssText='padding:8px 0;margin-top:10px;border-top:1px solid #58708b';
const ct=document.createElement('h4');ct.textContent='V39 黄金調教 × 過去7走能力証拠';crossSection.append(ct);
const cp=document.createElement('p');cp.textContent='現級・同芝ダ0.5秒以内／同距離同芝ダ3着内／直近5走3着内2回などを確認。過去のSOURCEの評価条件を勝手に加重せず、数字と根拠を表示。';crossSection.append(cp);
const gt2=document.createElement('table');gt2.style.cssText='width:100%;border-collapse:collapse;font-size:12px';
const cols=['馬番・馬名','黄金型','現級同面0.5秒以内','同距離同面3着内','近5走3着内','証拠・注意'];
const head=document.createElement('tr');for(const v of cols){const th=document.createElement('th');th.textContent=v;th.style.cssText='padding:5px;border-bottom:1px solid #58708b;text-align:left';head.append(th)}gt2.append(head);
let joined=0;
for(const h of r.horses){const v=h[9]?.v39_gold_ability_crosscheck;if(!v?.golden_type_count)continue;joined++;
const fields=[h[0]+' '+h[1],v.golden_types.join('＋'),String(v.same_class_surface_within_half_sec_7),String(v.same_distance_surface_top3_7),String(v.last5_top3_n),(v.positive_evidence?.join('、')||'該当証拠なし')+'／注意：'+(v.cautions?.join('、')||'特記なし')];
const row=document.createElement('tr');for(const textValue of fields){const td=document.createElement('td');td.textContent=textValue;td.style.cssText='padding:5px;border-bottom:1px solid #304157';row.append(td)}gt2.append(row)}
if(joined)crossSection.append(gt2);else{const p=document.createElement('p');p.textContent='このレースはV39の黄金4型一致馬なし';crossSection.append(p)}
facts.append(crossSection);
/* Today's practical first-screen dashboard: show all runners and per-horse evidence now. */
const now=document.createElement('section');now.style.cssText='margin:12px 0;padding:12px;border:2px solid #38c8a7;border-radius:10px;background:#10283a';
const nh=document.createElement('h3');nh.textContent='全頭研究結果｜'+r.venue+r.race_no+'R';now.append(nh);
const np=document.createElement('p');np.textContent='334頭の統合SOURCEからこのレースを抽出。過去走・能力・展開・調教・黄金を並べて確認。指数・買い目ではなく検証済みの事実を表示。';now.append(np);
const all=document.createElement('div');all.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px';
const idx=Object.fromEntries(item.data.past_fields.map((x,i)=>[x,i]));
function showValue(v){return v===null||v===undefined||v===''?'未取得':String(v)}
for(const h of r.horses){
const m=h[9]||{},a=m.v35_factual_feature_card||{},b=m.v36_pre_race_position_fatigue_audit||{},t=m.v37_twin_origin_v010||{},g=m.v38_golden_wood_scout_v010||{},c=m.v39_gold_ability_crosscheck||{};
const card=document.createElement('details');card.style.cssText='border:1px solid #57758d;border-radius:8px;background:#1c3048;padding:9px';
const heading=document.createElement('summary');heading.style.cssText='cursor:pointer;font-weight:700';
const golden=Object.entries(g.types||{}).filter(x=>x[1]).map(x=>x[0]).join('＋');
heading.textContent=h[0]+'番 '+h[1]+(golden?' 🟡黄金':'')+(t.best_origin?.top5_uploaded_day_research?' ◇双子原点':'');card.append(heading);
const brief=document.createElement('p');brief.style.cssText='font-size:13px;margin:7px 0';
brief.textContent='過去'+(h[8]?.length||0)+'走｜3着以内'+showValue(a['直近7走3着以内回数'])+'回｜同距離'+showValue(a['同距離走数'])+'走｜前走'+showValue(a['前走着順'])+'着';card.append(brief);
const detail=document.createElement('div');detail.style.cssText='font-size:12px;white-space:normal';
const txt='同距離3着内 '+showValue(c.same_distance_surface_top3_7)+'回／現級同面0.5秒内 '+showValue(c.same_class_surface_within_half_sec_7)+'回\n展開 '+showValue(b.position_category||b.position_profile||b.position_bucket)+'／休養 '+showValue(b.days_since_previous_run||b.rest_days)+'日\n黄金 '+(golden||'非該当・未検証')+'／坂路双子原点 '+(t.best_origin?'D='+t.best_origin.origin_mean_D.toFixed(3):'未取得')+'\n調教照合 '+showValue(m.training_status)+'\n注意 '+(c.cautions||[]).join('、');
const lines=document.createElement('p');lines.style.whiteSpace='pre-line';lines.textContent=txt;detail.append(lines);
const ttable=document.createElement('table');ttable.style.cssText='font-size:11px;width:100%;border-collapse:collapse';
for(const v of ['日付','距離','着順','時計','4角','上がり']){const th=document.createElement('th');th.textContent=v;th.style.padding='2px';ttable.append(th)}
for(const p of h[8]||[]){const row=document.createElement('tr');const fields=[p[idx.date],showValue(p[idx.surface])+showValue(p[idx.distance_m]),showValue(p[idx.finish_position]),showValue(p[idx.finish_time_seconds]),showValue(p[idx.corner_4]),showValue(p[idx.last3f_seconds])];for(const v of fields){const td=document.createElement('td');td.textContent=v;td.style.cssText='padding:2px;border-bottom:1px solid #33465c';row.append(td)}ttable.append(row)}
detail.append(ttable);card.append(detail);all.append(card)
}
now.append(all);facts.insertBefore(now,facts.firstChild);
facts.hidden=!tbl.querySelector('td');
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