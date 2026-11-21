/* V107: Cross-evidence audit for all starters, descriptive only. No fabricated win probability or buy signal. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v107Status'),root=$('v107Results');if(!status||!root)return;
let audit=null;
const norm=x=>String(x??'').normalize('NFKC').replace(/[\s　]+/g,'').trim();
const number=x=>{if(x===null||x===undefined||String(x).trim()==='')return null;const v=Number(x);return Number.isFinite(v)?v:null};
const nameKey=x=>norm(x).toLowerCase();
const key=r=>[r?.date,r?.venue,String(r?.race_no)].join('|');
const selected=()=>[$('v90Date')?.value,$('v90Venue')?.value,String($('v90Race')?.value)].join('|');
const element=(tag,value='')=>{const el=document.createElement(tag);el.textContent=String(value);return el;};
function addRow(table,values,header=false){const r=element('tr');for(const x of values)r.append(element(header?'th':'td',x));table.append(r)}
function idx(headers,names){for(const n of names){const i=headers.findIndex(x=>nameKey(x)===nameKey(n));if(i>=0)return i}return -1}
function date(x){const s=String(x??'').trim();let m=s.match(/^(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');m=s.match(/^(\d{4})(\d{2})(\d{2})$/);return m?m[1]+'-'+m[2]+'-'+m[3]:''}
const GOLD=['DUAL_END','SUSTAINED_DRIVE','LONG_SUSTAIN','HIDDEN_KICK'];
const truth=x=>['1','TRUE','YES','Y','○','〇','該当'].includes(norm(x).toUpperCase());
async function official(cutoff){
const file=$('v92Official')?.files?.[0];
if(!file)return {available:false,byId:new Map(),reason:'正式SOURCE未入力'};
if(!window.v87Bridge?.decodeCSV)throw Error('正式SOURCE CSVのパーサがありません');
const rows=await window.v87Bridge.decodeCSV(file);
if(!rows.length)throw Error('正式SOURCE CSVはヘッダーが必要です');
const h=rows[0].map(x=>String(x??'').trim().replace(/^\uFEFF/,''));
const idCol=idx(h,['血統登録番号','horse_id']),nameCol=idx(h,['馬名','horse_name']),trainerCol=idx(h,['調教師','trainer']);
const when=idx(h,['調教日','日付','年月日','date']),flags=GOLD.map(k=>idx(h,[k]));
if(idCol<0||nameCol<0||trainerCol<0||when<0||flags.some(i=>i<0))throw Error('正式黄金SOURCEは血統登録番号・馬名・調教師・日付・4フラグ列が必須。馬名だけの照合は禁止');
const byId=new Map();let future=0,badDates=0,invalid=0;
for(const row of rows.slice(1)){
const horseID=String(row[idCol]??'').trim(),horseName=nameKey(row[nameCol]),trainer=nameKey(row[trainerCol]),d=date(row[when]);
if(!/^\d{10}$/.test(horseID)||!horseName||!trainer){invalid++;continue}
if(!d){badDates++;continue}
if(d>=cutoff){future++;continue}
const existing=byId.get(horseID);
if(existing&&(existing.name!==horseName||existing.trainer!==trainer))throw Error('正式SOURCE内の同一馬IDで馬名・調教師が不一致');
const x=existing||{name:horseName,trainer,flags:[false,false,false,false],dates:[]};
flags.forEach((i,j)=>{x.flags[j]=x.flags[j]||truth(row[i])});
x.dates.push(d);
byId.set(horseID,x);
}
return {available:true,byId,future,badDates,invalid,
reason:'保存済み黄金SOURCE 10/31〜11/13の過去フラグ。11/14以降の正式判定は未照合'};
}

/* Real wood/hill CSV observations already embedded in the one-file private bundle.
   This does NOT infer official GOLD/TWIN flags. */
async function rawTraining(cutoff){
if(!window.v87Bridge?.decodeCSV)throw Error('調教CSVパーサ未接続');
const samples=new Map(),issues=[],types=[['ウッド','v91Wood'],['坂路','v91Hill']];
let total=0;
for(const [type,id] of types){
const file=$(id)?.files?.[0];if(!file){issues.push(type+'未入力');continue;}
const csv=await window.v87Bridge.decodeCSV(file);
if(!csv?.length){issues.push(type+'CSV空');continue;}
const heads=csv[0].map(v=>String(v??'').replace(/^\uFEFF/,'').trim());
const horse=idx(heads,['馬名','horse_name','horse','name']),day=idx(heads,['年月日','日付','調教日','date','workout_date']),trainer=idx(heads,['調教師','trainer']),course=idx(heads,['コース','course']);
const laps=['4F','3F','2F','1F'].map(v=>idx(heads,[v]));
const intervalLaps=['L4','L3','L2','L1'].map(v=>idx(heads,[v,'lap'+v.slice(1)]));
if(horse<0||day<0||laps.every(x=>x<0))throw Error(type+'：馬名・調教日・時計列がありません');
for(const r of csv.slice(1)){
const name=nameKey(r[horse]),d=date(r[day]);if(!name||!d||d>=cutoff)continue;
const clock=laps.map(i=>i<0?null:number(r[i]));
if(clock.every(v=>v===null))continue;
const interval=intervalLaps.map(i=>i<0?null:number(r[i]));
const a={date:d,type,trainer:trainer<0?'':nameKey(r[trainer]),course:course<0?'':String(r[course]||''),clock,interval};
if(!samples.has(name))samples.set(name,[]);samples.get(name).push(a);total++;
}
}
for(const a of samples.values())a.sort((x,y)=>y.date.localeCompare(x.date)||x.type.localeCompare(y.type));
return {samples,issues,total};
}
function trainingForHorse(training,h){
const found=training.samples.get(nameKey(h[1]))||[];
const expected=nameKey(h[9]?.trainer);
const matched=found.filter(x=>!expected||!x.trainer||expected===x.trainer);
const excluded=found.length-matched.length;
const results=[];
for(const type of ['ウッド','坂路']){
const byType=matched.filter(x=>x.type===type);
if(!byType.length){results.push(type+'：照合記録なし');continue;}
const a=byType[0];
const clocks=a.clock.map((v,i)=>['4F','3F','2F','1F'][i]+' '+(v===null?'―':v.toFixed(1))).join('／');
const prev=byType.find(x=>x.date<a.date&&x.course===a.course&&x.clock[3]!==null);
const delta=a.clock[3]!==null&&prev?+(a.clock[3]-prev.clock[3]).toFixed(1):null;
results.push(type+'：'+a.date+' '+a.course+'｜'+clocks+'｜前回同コース1F比 '+(delta===null?'比較不可':(delta>0?'+':'')+delta.toFixed(1)+'秒')+'（'+byType.length+'記録）');
}
const hill=matched.filter(x=>x.type==='坂路'&&x.interval?.length===4&&x.interval.every(v=>v!==null&&v>0));
const latest=hill[0],prior=hill.find(x=>latest&&x.date<latest.date&&x.course===latest.course);
if(latest&&prior){
const delta=latest.interval.map((v,i)=>v-prior.interval[i]);
const D=Math.sqrt(0.2*delta[0]**2+0.5*delta[1]**2+1.0*delta[2]**2+1.2*delta[3]**2);
results.push('双子原点式D：'+D.toFixed(3)+'（'+latest.date+'対'+prior.date+'、同馬・同コースの実測ラップ形状差）。過去好走調教との照合ではないため、双子「陽性」とは判定不可。');
}else results.push('双子原点式：同コース・別日・L4〜L1がそろう坂路2記録がないため比較不可。正式好走基準未照合。');
return {text:results.join('\n'),count:matched.length,excluded,trainerVerified:!!expected&&matched.every(x=>!!x.trainer),has:matched.length>0};
}

async function market(race){
const file=$('v96Single')?.files?.[0];if(!file)return {available:false,byNumber:new Map(),medians:new Map()};
if(!window.v87Bridge?.decodeCSV)throw Error('単複CSVパーサがありません');
const rows=await window.v87Bridge.decodeCSV(file);if(rows.length<2)throw Error('単複CSVが空です');
const h=rows[0].map(x=>String(x??'').trim().replace(/^\uFEFF/,''));
const columns=['date','venue','race_no','horse_number','win_odds','place_upper','captured_at'];
const ix=columns.map(k=>idx(h,[k]));
if(ix.some(i=>i<0))throw Error('単複CSVの必須列不足：'+columns.filter((k,j)=>ix[j]<0).join('・'));
const seen=new Map(),time=new Set();
for(const r of rows.slice(1)){
if(date(r[ix[0]])!==race.date||norm(r[ix[1]])!==norm(race.venue)||number(r[ix[2]])!==number(race.race_no))continue;
const no=number(r[ix[3]]),win=number(r[ix[4]]),place=number(r[ix[5]]),stamp=String(r[ix[6]]??'').trim();
if(!Number.isInteger(no)||no<1||win===null||win<1||place===null||place<1||!stamp||seen.has(no))throw Error('単複CSVの馬番・オッズ・時刻に重複または不正');
seen.set(no,{no,win,place});time.add(stamp);
}
if(seen.size!==race.horses.length||time.size!==1||race.horses.some(h=>!seen.has(h[0])))throw Error('単複オッズは対象レース全頭・同一取得時刻が必要');
const win=[...seen.values()].sort((a,b)=>a.win-b.win||a.no-b.no);
const place=[...seen.values()].sort((a,b)=>a.place-b.place||a.no-b.no);
function median(arr){const count=arr.length;if(!count)return [];const k=Math.floor((count-1)/2);return count%2?[arr[k]]:[arr[k],arr[k+1]]}
const wall6=place.findIndex(x=>x.place>=6),wall15=place.findIndex(x=>x.place>=15);
const records=[
['赤オッズ中央',median(win.filter(x=>x.win<10))],
['20倍以内中央',median(win.filter(x=>x.win<=20))],
['全体中央',median(win)],
['P6中央',wall6<0?[]:median(place.slice(0,Math.max(0,wall6-2)))],
['P15→P6中央',wall6<0?[]:median(place.slice(Math.max(0,wall6-1),Math.max(0,(wall15<0?place.length:wall15)-2)))]
];
const medians=new Map();for(const [label,rs] of records)for(const x of rs){if(!medians.has(x.no))medians.set(x.no,[]);medians.get(x.no).push(label)}
return {available:true,byNumber:seen,medians,time:[...time][0]};
}
function past(h,fields,dateValue){
if(!Array.isArray(h[8])||h[8].length>10)throw Error(h[1]+'：走歴数不正');
const used=new Set();
return h[8].map(row=>{
if(!Array.isArray(row)||row.length!==fields.length)throw Error(h[1]+'：過去走の列数異常');
const r=Object.fromEntries(fields.map((field,i)=>[field,row[i]]));
if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))||r.date>=dateValue||r.source_status!=='STRICT_ID_MATCH'||used.has(r.race_id))throw Error(h[1]+'：履歴の未来日・正式ID不整合・重複');
used.add(r.race_id);return r;
}).sort((a,b)=>b.date.localeCompare(a.date));
}
function factors(h,fields,r){
const hist=past(h,fields,r.date),recent=hist.slice(0,5);
const top=x=>{const z=number(x.finish_position);return z!==null&&z>=1&&z<=3};
const same=hist.filter(x=>norm(x.surface)===norm(r.surface)&&number(x.distance_m)===number(r.distance_m));
const recentTop=recent.filter(top).length, sameTop=same.filter(top).length;
const frontDrop=hist.filter(x=>{const size=number(x.field_size),start=number(x.corner_1),end=number(x.corner_4),finish=number(x.finish_position);return size!==null&&size>=2&&start!==null&&end!==null&&finish!==null&&start>=1&&end>=1&&finish>=1&&finish<=size&&start<=size&&end<=size&&start/size<=1/3&&(end-finish)/size<=-.2}).length;
const move=hist.filter(x=>{const size=number(x.field_size),first=number(x.corner_1),fourth=number(x.corner_4);return size!==null&&size>=2&&first!==null&&fourth!==null&&first>=1&&fourth>=1&&first<=size&&fourth<=size&&(first-fourth)/size>=.2}).length;
const last=hist[0],oldDist=number(last?.distance_m),dist=number(r.distance_m);
const cut=oldDist!==null&&dist!==null&&oldDist>dist;
const lastFront=last?frontDropRule(last):false;
function frontDropRule(x){const size=number(x.field_size),start=number(x.corner_1),end=number(x.corner_4),fin=number(x.finish_position);return size!==null&&size>=2&&start!==null&&end!==null&&fin!==null&&start>=1&&end>=1&&fin>=1&&fin<=size&&start<=size&&end<=size&&start/size<=1/3&&(end-fin)/size<=-.2}
return {hist:hist.length,top5:recentTop,denom:recent.length,sameTop,sameN:same.length,frontDrop,move,cut,cutFront:cut&&lastFront,complete:hist.length===10||h[9]?.completeness_confirmed===true};
}
window.addEventListener('v86-upcoming-import',e=>{const x=e.detail;if(x?.schema==='TARGET_V86_UPCOMING_RACE_V1'&&x.race&&key(x.race)===selected()){audit=x;root.replaceChildren();status.textContent='同一レースの過去走を受信。調教・市場CSVがあれば馬ごとに重ねて表示できます。';}});
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',()=>{audit=null;root.replaceChildren();status.textContent='HOLD：レース変更。横断監査を消去しました。'});
$('v107Run').addEventListener('click',async()=>{
const button=$('v107Run');button.disabled=true;root.replaceChildren();
try{
const x=audit,r=x?.race;if(!r||key(r)!==selected())throw Error('V90から同一レースの過去10走を転送してください');
if(r.horse_count!==r.horses.length)throw Error('全頭数不一致');
const required=['date','distance_m','finish_position','surface','corner_1','corner_4','field_size','race_id','source_status'];
if(required.some(k=>!x.past_fields?.includes(k)))throw Error('過去走の必須列不足');
const [gold,odds,training]=await Promise.all([official(r.date),market(r),rawTraining(r.date)]);
if(audit!==x||key(r)!==selected())throw Error('CSV読込中にレースが変更されました。旧結果を破棄します');
const table=element('table');
const mobileCards=element('div');mobileCards.className='v107MobileCards';
addRow(table,['馬番・馬名','走歴・直近5走3着内','今回同距離3着内','過去の位置変化','前走失速×今回短縮','過去黄金SOURCE','メジアン重複（参考）','単勝','資料状態'],true);
let goldYes=0,overlap=0,missing=0,trainingCovered=0;
for(const horse of [...r.horses].sort((a,b)=>a[0]-b[0])){
const z=factors(horse,x.past_fields,r),raw=trainingForHorse(training,horse);if(raw.has)trainingCovered++;
const candidate=gold.byId.get(String(horse[2]));
const flag=candidate&&candidate.name===nameKey(horse[1])&&candidate.trainer===nameKey(horse[9]?.trainer)?candidate:null;
const matched=flag?GOLD.filter((_,i)=>flag.flags[i]):[];
const goldDate=flag?.dates?.slice().sort().pop();
const goldAge=goldDate?Math.round((new Date(r.date+'T00:00:00Z')-new Date(goldDate+'T00:00:00Z'))/86400000):null;
const goldLabel=!gold.available?'正式SOURCE未入力（陰性ではない）':matched.length?matched.join('／')+'｜過去SOURCE '+goldDate+'（発走'+goldAge+'日前、最終追切判定ではない）':'過去SOURCE内に該当なし（11/14以降未監査、陰性未確定）';
const m=odds.medians.get(horse[0])||[],price=odds.byNumber.get(horse[0]);
if(matched.length)goldYes++;
const evidence=['同距離好走','位置変化','黄金'].filter(a=>a==='同距離好走'?z.sameTop>0:a==='位置変化'?z.frontDrop>0||z.move>0:matched.length>0);
if(evidence.length>=2)overlap++;
const sources=[];
if(!z.complete)sources.push('全キャリア未確定');
if(!gold.available)sources.push('調教SOURCE未入力');else if(!flag)sources.push('10/31〜11/13のSOURCE該当なし・11/14以降未監査');else sources.push('11/14以降の正式黄金SOURCE未監査');
if(!odds.available)sources.push('単複市場未入力');
if(sources.length)missing++;
addRow(table,[horse[0]+' '+horse[1],z.hist+'走・'+z.top5+'/'+z.denom,z.sameTop+'/'+z.sameN,'先行→後退'+z.frontDrop+'／道中進出'+z.move,z.cutFront?'観測あり':z.cut?'短縮のみ':'該当なし',goldLabel,m.length?m.join('／'):'該当なし',price?price.win.toFixed(1)+'倍':'未入力',sources.join('／')||'情報あり・期待値HOLD']);
const card=element('details');card.className='v107MobileHorse';
const summary=element('summary',horse[0]+'番 '+horse[1]+'｜過去'+z.hist+'走｜同距離3着内'+z.sameTop+'回');
card.append(summary);
const evidenceLine=element('p',evidence.length?'観測材料：'+evidence.join('・'):'条件が重なる好走材料は未確認');evidenceLine.className='v107Highlight';card.append(evidenceLine);
const fieldsForCard=[
['過去走',z.hist+'走／直近5走の3着内 '+z.top5+'/'+z.denom],
['同芝ダ・同距離',z.sameTop+'/'+z.sameN+'走が3着内'],
['過去の位置変化','先行→後退 '+z.frontDrop+'回／道中進出 '+z.move+'回'],
['前走失速×今回短縮',z.cutFront?'該当':z.cut?'短縮のみ':'該当なし'],
['生調教（実測・正式黄金判定とは別）',raw.text],
['正式黄金SOURCE（過去10/31〜11/13）',goldLabel],
['単勝・メジアン',price?price.win.toFixed(1)+'倍／'+(m.join('・')||'該当なし'):'単勝市場未入力'],
['未確認事項',sources.join('／')||'最終の期待値・馬体重は未確認']
];
for(const [label,value] of fieldsForCard){const field=element('p');const bold=element('strong',label+'：');field.append(bold,document.createTextNode(value));card.append(field)}
mobileCards.append(card);
}
const scroll=element('div');scroll.className='scroll v107WideTable';scroll.append(table);root.append(scroll);root.append(mobileCards);
status.textContent=r.date+' '+r.venue+r.race_no+'R 全'+r.horse_count+'頭を横断表示。10/31〜11/13の過去黄金SOURCEフラグ該当'+goldYes+'頭／過去走・位置変化・黄金のうち2領域以上で観測'+overlap+'頭／生調教照合'+trainingCovered+'頭／資料不足'+missing+'頭。単勝市場：'+(odds.available?odds.time:'未入力')+'。過去黄金SOURCEは10/31〜11/13の記録で11/14以降の最新正式判定ではありません。生調教の時計と前回同コース比は別扱いです。重複の独立加点はせず、能力勝率・期待値・馬体重/直前オッズ未照合のため馬券HOLD。';
}catch(e){status.textContent='HOLD：'+e.message}finally{button.disabled=false}
});
})();