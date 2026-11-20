/* V93: pre-race historical ability x official training flags, without arbitrary ranking weights. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v93Status'),target=$('v93Results');
if(!status||!target)return;
let snapshot=null;
window.addEventListener('v86-upcoming-import',e=>{const x=e.detail;if(x?.schema==='TARGET_V86_UPCOMING_RACE_V1'){snapshot=x;status.textContent='全頭10走データを受信。黄金SOURCE CSVを読み込むと能力・調教の交差監査ができます。';}});
const norm=x=>String(x??'').normalize('NFKC').replace(/[\s　]+/g,'').trim(), n=x=>x===''||x==null?null:Number.isFinite(Number(x))?Number(x):null;
const alias=(heads,keys)=>{for(const k of keys){const i=heads.findIndex(x=>norm(x).toLowerCase()===norm(k).toLowerCase());if(i>=0)return i;}return -1;};
function dateISO(x){const s=String(x??'').trim();let m=s.match(/^(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');m=s.match(/^(\d{4})(\d{2})(\d{2})$/);return m?m[1]+'-'+m[2]+'-'+m[3]:'';}
function dayDiff(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);}
const gold=['DUAL_END','SUSTAINED_DRIVE','LONG_SUSTAIN','HIDDEN_KICK'];
function flag(v){return ['1','TRUE','YES','Y','○','〇','該当'].includes(norm(v).toUpperCase());}
async function official(date){
const file=$('v92Official')?.files[0];if(!file)return null;
if(!window.v87Bridge?.decodeCSV)throw Error('CSVパーサ未接続');
const rows=await window.v87Bridge.decodeCSV(file);const h=rows.shift().map(x=>String(x??'').replace(/^\uFEFF/,'').trim());
const i=alias(h,['馬名','horse_name','horse','name']),d=alias(h,['調教日','日付','年月日','date','workout_date']);
const fs=gold.map(k=>alias(h,[k]));if(i<0||d<0||fs.some(x=>x<0))throw Error('V92正式SOURCEの馬名・日付・4黄金フラグ列が不足');
const m=new Map();let future=0,unknown=0;
for(const row of rows){const name=norm(row[i]),work=dateISO(row[d]);if(!name)continue;if(!work){unknown++;continue;}if(work>=date){future++;continue;}const old=m.get(name)||{flags:[false,false,false,false],dates:[]};fs.forEach((j,k)=>{old.flags[k] ||=flag(row[j]);});old.dates.push(work);m.set(name,old);}
return {map:m,future,unknown};
}
const td=(tr,x)=>{let cell=document.createElement('td');cell.textContent=x;tr.append(cell);};
function info(h,fields,r){
const idx=new Map(fields.map((key,i)=>[key,i]));
const hist=(h[8]||[]).map(raw=>Object.fromEntries(fields.map((k,i)=>[k,raw[i]]))).filter(x=>x.date&&x.date<r.date).sort((a,b)=>b.date.localeCompare(a.date));
if(hist.length!==(h[8]||[]).length)throw Error('未来走または不正な走歴を検出：'+h[1]);
if(hist.length>10)throw Error('10走を超えるデータ：'+h[1]);
if(hist.some(x=>x.source_status!=='STRICT_ID_MATCH'))throw Error('非正式ID走歴：'+h[1]);
const valid=hist.filter(x=>{const z=n(x.finish_position);return z!==null&&z>=1&&z<=28;});
const top3=valid.filter(x=>n(x.finish_position)<=3).length;
const same=valid.filter(x=>n(x.distance_m)===n(r.distance_m)&&norm(x.surface)===norm(r.surface));
const sameTop3=same.filter(x=>n(x.finish_position)<=3).length;
const last5=valid.slice(0,5),last5Top3=last5.filter(x=>n(x.finish_position)<=3).length;
const recent=hist[0]?.date||null,days=recent?dayDiff(recent,r.date):null;
const early=valid.map(x=>n(x.corner_1)).filter(x=>x!==null),late=valid.map(x=>n(x.corner_4)).filter(x=>x!==null);
const q=valid.filter(x=>n(x.field_size)>0&&n(x.corner_4)>0&&n(x.corner_4)<=n(x.field_size)).map(x=>n(x.corner_4)/n(x.field_size));
const avg=q.length?q.reduce((a,b)=>a+b,0)/q.length:null;
const zero=hist.length===0,first=String(h[9]?.basis||'')==='JRA_NEWCOMER_DEBUT_AND_ALL_LINKED_RACES';
const coverage=zero?(first?'新馬・過去走なし':'HOLD：履歴なし'):hist.length===10?'10走照合':'10走未満・全キャリア確認要';
const factors={hist:hist.length,top3,sameCount:same.length,sameTop3,last5Top3,days,avg4:avg,coverage};
const suspect=!(h[3]==='10走正式ID照合完了_能力等未監査'||first)||(!first&&hist.length<10);
return {factors,suspect};
}
$('v93Run').addEventListener('click',async()=>{
const button=$('v93Run');button.disabled=true;target.replaceChildren();status.textContent='全頭10走・正式調教を結合中…';
try{
if(!snapshot)throw Error('先にV90→全頭10走転送を実行してください');
const r=snapshot.race,fields=snapshot.past_fields;
if(r.date!==$('v90Date').value||r.venue!==$('v90Venue').value||Number(r.race_no)!==Number($('v90Race').value))throw Error('V90選択中のレースと監査データが不一致。再転送してください');
if(r.horses.length!==r.horse_count)throw Error('出走頭数が一致しません');
const source=await official(r.date),table=document.createElement('table'),head=document.createElement('tr');
['馬番・馬名','履歴','直近5走3着内','同芝ダ・同距離3着内','前走間隔','4角位置率（小ほど前）','黄金SOURCE','ゲート'].forEach(x=>{const th=document.createElement('th');th.textContent=x;head.append(th);});table.append(head);
let hold=0,positive=0;
for(const h of [...r.horses].sort((a,b)=>a[0]-b[0])){
const z=info(h,fields,r),f=z.factors,g=source?.map.get(norm(h[1]));const tr=document.createElement('tr');
td(tr,h[0]+' '+h[1]);td(tr,f.hist+'/10（'+f.coverage+'）');td(tr,f.hist?f.last5Top3+'/'+Math.min(5,f.hist):'―');
td(tr,f.sameCount?f.sameTop3+'/'+f.sameCount:'該当走なし');td(tr,f.days===null?'―':f.days+'日');
td(tr,f.avg4===null?'―':f.avg4.toFixed(3));
const golden=g?gold.filter((_,i)=>g.flags[i]).map(x=>x.replace('SUSTAINED_DRIVE','SUST').replace('LONG_SUSTAIN','LONG').replace('HIDDEN_KICK','HIDDEN')).join(' / ')||'フラグなし':source?'原票なし':'CSV未読込';td(tr,golden);
if(g?.flags.some(Boolean))positive++;
const needs=z.suspect||!source||!g;
if(needs)hold++;td(tr,needs?'HOLD：要追加監査':'比較因子確認・最終判定HOLD');table.append(tr);
}
const wrap=document.createElement('div');wrap.className='scroll';wrap.append(table);target.append(wrap);
status.textContent=r.date+' '+r.venue+r.race_no+'R：全'+r.horse_count+'頭を結合。黄金陽性 '+positive+'頭、SOURCE・走歴不足 '+hold+'頭。'+(source?'未来調教 '+source.future+'件を除外／日付不明 '+source.unknown+'件を除外。':'正式SOURCE未読込。')+'過去の成績と調教の交差表示であり、独自の合成点数・確率・馬券を生成しません。全頭過去走、当日馬場、オッズ、展開、疲労の最終監査までは買い目HOLD。';
}catch(e){status.textContent='HOLD：'+e.message;}finally{button.disabled=false;}
});
})();