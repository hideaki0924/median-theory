/* V98 import preflight (private files are only read locally). */
(()=>{'use strict';
const $=id=>document.getElementById(id),state=$('v98Status'),body=$('v98Results');
if(!state||!body)return;
const safe=s=>String(s??'').normalize('NFKC').replace(/^[\uFEFF]/,'').trim();
const ci=(h,keys)=>{for(const x of keys){const i=h.findIndex(v=>safe(v).toLowerCase()===safe(x).toLowerCase());if(i>=0)return i}return -1};
const dataDate=x=>{const v=safe(x),m=v.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):v};
const requiredHistory=['年','月','日','距離','確定着順','走破タイム','レースID','血統登録番号','場所','通過順1','通過順2','通過順3','通過順4'];
const requiredEntries=['date','venue','race_no','surface','distance_m','class_name','horse_number','horse_name'];
const requiredGold=['DUAL_END','SUSTAINED_DRIVE','LONG_SUSTAIN','HIDDEN_KICK'];
const button=$('v98Check');
const checks=[];
const line=(name,state,detail)=>checks.push({name,state,detail});
function display(){
 body.replaceChildren();const t=document.createElement('table');const h=document.createElement('tr');for(const s of ['検査項目','結果','詳細']){const v=document.createElement('th');v.textContent=s;h.append(v)}t.append(h);
 for(const x of checks){const r=document.createElement('tr');for(const s of [x.name,x.state,x.detail]){const v=document.createElement('td');v.textContent=s;r.append(v)}t.append(r)}const div=document.createElement('div');div.className='scroll';div.append(t);body.append(div);
 const bad=checks.filter(x=>x.state==='HOLD').length,warn=checks.filter(x=>x.state==='未検証').length;
 state.textContent='事前診断 '+checks.length+'項目：HOLD '+bad+'／未検証 '+warn+'。'+(bad?'入力不足または形式不一致を修正するまで解析不可。':'形式チェックは通過。ただし実戦完成判定ではありません。')+'購入判定は常にHOLD。';
}
async function parse(file,required,label){
 if(!file){line(label,'未検証','CSV未選択');return null}
 if(!window.v87Bridge?.decodeCSV){line(label,'HOLD','既存TARGET CSVパーサがない');return null}
 let rows;try{rows=await window.v87Bridge.decodeCSV(file)}catch(e){line(label,'HOLD',String(e.message||e));return null}
 if(!Array.isArray(rows)||rows.length<2){line(label,'HOLD','ヘッダーまたはデータ行が不足');return null}
 const h=rows[0].map(safe),missing=required.filter(k=>ci(h,[k])<0);
 if(missing.length){line(label,'HOLD','不足列：'+missing.join('、'));return null}
 const ragged=rows.slice(1).filter(r=>r.length!==h.length).length;
 if(ragged){line(label,'HOLD','列数不一致 '+ragged+'行');return null}
 line(label,'形式PASS',rows.length-1+'件／'+h.length+'列。先頭列：'+h.slice(0,6).join('、'));
 return {h,rows:rows.slice(1)};
}
async function run(){
 button.disabled=true;checks.length=0;state.textContent='端末内CSVを検査中…';body.replaceChildren();
 try{
 const race={date:$('v90Date')?.value,venue:$('v90Venue')?.value,no:Number($('v90Race')?.value)};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(race.date)||!race.venue||!Number.isInteger(race.no)||race.no<1||race.no>12){line('レース選択','HOLD','開催日・競馬場・Rが不正');display();return}
 line('レース選択','形式PASS',race.date+' '+race.venue+race.no+'R');
 const entry=await parse($('v90Entries')?.files?.[0],requiredEntries,'出馬表CSV');
 if(entry){
  const h=entry.h, d=ci(h,['date']),v=ci(h,['venue']),r=ci(h,['race_no']),no=ci(h,['horse_number']),hn=ci(h,['horse_name']);
  const found=entry.rows.filter(x=>dataDate(x[d])===race.date&&safe(x[v])===race.venue&&Number(x[r])===race.no);
  const numbers=new Set(),names=new Set();let duplicates=0;for(const x of found){const num=Number(x[no]),name=safe(x[hn]);if(!Number.isInteger(num)||num<1||num>28||!name||numbers.has(num)||names.has(name))duplicates++;numbers.add(num);names.add(name)}
  line('選択レース出走馬',found.length<2||found.length>28||duplicates?'HOLD':'形式PASS',found.length+'頭／重複または不正 '+duplicates+'件');
 }else if(race.date==='2026-11-21'&&race.venue==='福島'&&race.no===11){line('V89内蔵出馬表','形式PASS','福島11R内蔵分を利用可能。ただし取消・変更は別途再確認')}
 const hist=await parse($('v90History')?.files?.[0]||$('v87History')?.files?.[0],requiredHistory,'TARGET成績固定CSV');
 if(hist){
  const h=hist.h, yi=ci(h,['年']),mi=ci(h,['月']),di=ci(h,['日']),ids=ci(h,['血統登録番号']),raceIds=ci(h,['レースID']);
  let badDate=0,after=0,without=0;
  for(const x of hist.rows){const y=String(x[yi]||'').trim(),yr=y.length===2?'20'+y:y;const dt=dataDate(yr+'-'+x[mi]+'-'+x[di]);if(!/^\d{4}-\d{2}-\d{2}$/.test(dt)){badDate++;continue}if(dt>=race.date)after++;if(!safe(x[ids])||!safe(x[raceIds]))without++;}
  line('TARGET日付・識別子',badDate||without?'HOLD':'形式PASS','日付不正 '+badDate+'／識別子欠損 '+without+'／当日以降の記録 '+after+'（実際の分析から除外必須）');
 }
 for(const [id,label] of [['v91Wood','ウッド調教'],['v91Hill','坂路調教']]){
  const file=$(id)?.files?.[0];if(!file){line(label,'未検証','CSV未選択');continue}
  if(!window.v87Bridge?.decodeCSV){line(label,'HOLD','CSVパーサなし');continue}
  try{const rows=await window.v87Bridge.decodeCSV(file);const h=(rows[0]||[]).map(safe);const who=ci(h,['馬名','horse_name','horse','name']),when=ci(h,['日付','調教日','年月日','date','workout_date','実施日']);line(label,who<0||when<0?'HOLD':'形式PASS',rows.length-1+'件。'+(who<0?'馬名列なし。':'')+(when<0?'日付列なし。':''))}catch(e){line(label,'HOLD',String(e.message||e))}
 }
 const goldFile=$('v92Official')?.files?.[0];if(goldFile)await parse(goldFile,['馬名',...requiredGold],'黄金正式SOURCE（列構成）');else line('黄金正式SOURCE','未検証','正式フラグCSV未選択。代替判定しない');
 line('発走前オッズ','未検証','V95/V96個別監査で取得時刻・全頭・複勝上限を確認');
 line('実戦ゲート','未検証','公式出馬表・全キャリア・直近走・当日馬場・斤量・調教・オッズ・期待値の最終統合は未完了');
 display();
 }catch(e){line('診断エラー','HOLD',String(e.message||e));display()}finally{button.disabled=false}
}
button.addEventListener('click',run);
})();