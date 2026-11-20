/* V95 evidence dashboard: race-local pre-race facts, no invented weights or ROI. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v95Status'),out=$('v95Results');
if(!status||!out)return;
const normalize=x=>String(x??'').normalize('NFKC').replace(/[\s　]+/g,'').trim();
const num=x=>{if(x===null||x===undefined||String(x).trim()==='')return null;const v=Number(x);return Number.isFinite(v)?v:null};
const yn=x=>['1','TRUE','YES','Y','○','〇','該当'].includes(normalize(x).toUpperCase());
const keys=['DUAL_END','SUSTAINED_DRIVE','LONG_SUSTAIN','HIDDEN_KICK'];
let snapshot=null;
window.addEventListener('v86-upcoming-import',e=>{if(e.detail?.schema==='TARGET_V86_UPCOMING_RACE_V1'){snapshot=e.detail;status.textContent='全頭10走のレース台帳を受信。統合監査を実行できます。';}});
const col=(h,names)=>{for(const n of names){const i=h.findIndex(x=>normalize(x).toLowerCase()===normalize(n).toLowerCase());if(i>=0)return i;}return -1};
function iso(x){const s=String(x??'').trim(),m=s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):s;}
function td(tr,v){const c=document.createElement('td');c.textContent=String(v);tr.append(c)}
async function csv(file){if(!file)return null;if(!window.v87Bridge?.decodeCSV)throw Error('CSV読込エンジンが未接続');const rows=await window.v87Bridge.decodeCSV(file);if(rows.length<2)throw Error(file.name+' はデータ不足');return {header:rows[0].map(s=>String(s??'').replace(/^\uFEFF/,'').trim()),rows:rows.slice(1)}}
async function gold(race){
const source=await csv($('v92Official')?.files[0]);if(!source)return {data:new Map(),state:'未読込',rejected:0};
const h=source.header,ni=col(h,['馬名','horse_name','horse','name']),di=col(h,['調教日','日付','年月日','date','workout_date']),f=keys.map(k=>col(h,[k]));
if(ni<0||di<0||f.some(x=>x<0))throw Error('正式黄金SOURCEの必須列不足');
let rejected=0,unknown=0;const m=new Map();
for(const row of source.rows){const date=iso(row[di]),name=normalize(row[ni]);if(!name)continue;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){unknown++;continue;}if(date>=race.date){rejected++;continue;}
const record=m.get(name)||[false,false,false,false];f.forEach((i,k)=>{record[k]=record[k]||yn(row[i])});m.set(name,record)}
return {data:m,state:'正式SOURCE',rejected,unknown};
}
async function market(race){
const source=await csv($('v95Odds')?.files[0]);if(!source)return {data:new Map(),state:'未読込'};
const h=source.header,di=col(h,['date','開催日']),vi=col(h,['venue','競馬場']),ri=col(h,['race_no','レース番号']),ni=col(h,['horse_number','馬番']),oi=col(h,['win_odds','単勝オッズ']),ti=col(h,['captured_at','取得時刻']);
if([di,vi,ri,ni,oi].some(x=>x<0))throw Error('単勝CSVにはdate,venue,race_no,horse_number,win_oddsが必要');
const m=new Map();for(const row of source.rows){if(iso(row[di])!==race.date||normalize(row[vi])!==normalize(race.venue)||num(row[ri])!==num(race.race_no))continue;
const no=num(row[ni]),odds=num(row[oi]);if(!Number.isInteger(no)||no<1||no>28||odds===null||odds<1)throw Error('単勝オッズ値または馬番が不正');
if(m.has(no))throw Error('同じ馬番のオッズが重複');m.set(no,{odds,time:ti<0?'':String(row[ti]||'')});}
if(m.size!==race.horse_count)throw Error('単勝CSVが全頭分ではありません（'+m.size+'/'+race.horse_count+'頭）。発走前の同一時刻オッズを使用してください');
const stamps=[...new Set([...m.values()].map(x=>x.time))];if(ti>=0&&(stamps.length!==1||!stamps[0]))throw Error('同一取得時刻のオッズに統一してください');
return {data:m,state:ti>=0?'同時刻の単勝オッズ':'取得時刻未記録'};
}
function analyze(h,fields,race){
const rows=h[8]||[];if(rows.length>10)throw Error('過去10走を超過：'+h[1]);
const ix=new Map(fields.map((n,i)=>[n,i]));
const hist=rows.map(row=>Object.fromEntries(fields.map((k,i)=>[k,row[i]]))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
if(hist.some(x=>!x.date||x.date>=race.date||x.source_status!=='STRICT_ID_MATCH'))throw Error('未来走・未照合履歴：'+h[1]);
const scored=hist.filter(x=>{const p=num(x.finish_position);return p!==null&&p>=1&&p<=28});
const last5=hist.slice(0,5),top5=last5.filter(x=>{const pos=num(x.finish_position);return pos!==null&&pos>=1&&pos<=3;}).length;
const same=scored.filter(x=>normalize(x.surface)===normalize(race.surface)&&num(x.distance_m)===num(race.distance_m));
const sameTop=same.filter(x=>num(x.finish_position)<=3).length;
const po=scored.filter(x=>{const a=num(x.corner_1),b=num(x.corner_4),f=num(x.field_size);return a!==null&&b!==null&&f!==null&&f>=2&&a>=1&&b>=1&&a<=f&&b<=f;});
const move=po.filter(x=>(num(x.corner_1)-num(x.corner_4))/num(x.field_size)>=.2).length;
const faded=po.filter(x=>(num(x.corner_1)-num(x.corner_4))/num(x.field_size)<=-.2).length;
const front=po.filter(x=>num(x.corner_1)/num(x.field_size)<=1/3).length;
const days=hist.length?Math.round((Date.parse(race.date+'T00:00:00Z')-Date.parse(hist[0].date+'T00:00:00Z'))/86400000):null;
const gaps=[];for(let i=0;i<hist.length-1;i++){const d=Math.round((Date.parse(hist[i].date+'T00:00:00Z')-Date.parse(hist[i+1].date+'T00:00:00Z'))/86400000);if(Number.isFinite(d)&&d>=0)gaps.push(d)}
const newcomer=h[9]?.basis==='JRA_NEWCOMER_DEBUT_AND_ALL_LINKED_RACES';
const tenValid=hist.length===10||newcomer;
return {n:hist.length,tenValid,top5,sameTop,sameN:same.length,move,faded,front,posN:po.length,days,short:gaps.filter(d=>d<=14).length,gapN:gaps.length};
}
$('v95Run').addEventListener('click',async()=>{
const b=$('v95Run');b.disabled=true;out.replaceChildren();status.textContent='統合監査中…';
try{
if(!snapshot)throw Error('まずV90で対象レースの過去走を転送してください');
const r=snapshot.race;if(r.date!==$('v90Date').value||r.venue!==$('v90Venue').value||Number(r.race_no)!==Number($('v90Race').value))throw Error('V90選択と台帳レースが一致しません');
if(r.horse_count!==r.horses.length)throw Error('全頭数が一致しません');
const [g,odds]=await Promise.all([gold(r),market(r)]);
const table=document.createElement('table'),head=document.createElement('tr');
['馬番・馬名','10走履歴','近5走3着内','同条件3着内','位置変化（上/下）','前走/連戦','黄金正式型','単勝','研究上の注目','状態'].forEach(t=>{const th=document.createElement('th');th.textContent=t;head.append(th)});table.append(head);
let observed=0,missing=0,goldPositive=0;
for(const h of [...r.horses].sort((a,b)=>a[0]-b[0])){
const a=analyze(h,snapshot.past_fields,r),flags=g.data.get(normalize(h[1])),o=odds.data.get(h[0]),tr=document.createElement('tr');
const gnames=flags?keys.filter((_,i)=>flags[i]):[],fine=gnames.length>0;
if(fine)goldPositive++;
const training=flags?(fine?gnames.join(' / '):'該当フラグなし'):'未照合';
const tags=[];if(a.n&&a.top5>=2)tags.push('直近好走反復（探索）');if(a.sameTop>0)tags.push('同条件好走実績');if(a.posN>=3&&a.move>a.faded)tags.push('道中進出観測');if(fine)tags.push('黄金SOURCE陽性');
const hold=!a.tenValid||!flags||!o||odds.state==='取得時刻未記録';
if(hold)missing++;else observed++;
const vals=[h[0]+' '+h[1],a.n+'/10'+(!a.tenValid?' ※要全キャリア確認':''),a.n?a.top5+'/'+Math.min(a.n,5):'―',a.sameN?a.sameTop+'/'+a.sameN:'対象なし',a.posN?a.move+'/'+a.faded+'（'+a.posN+'）':'不足',a.days===null?'不明':a.days+'日・短期'+a.short+'/'+a.gapN,training,o?o.odds.toFixed(1)+'倍':'未入力',tags.join('／')||'根拠不足',hold?'HOLD：資料不足':'比較可能・馬券HOLD'];vals.forEach(v=>td(tr,v));table.append(tr);
}
const div=document.createElement('div');div.className='scroll';div.append(table);out.append(div);
status.textContent=r.date+' '+r.venue+r.race_no+'R '+r.horse_count+'頭｜黄金陽性 '+goldPositive+'頭｜比較資料が揃う '+observed+'頭／不足 '+missing+'頭。'+(g.rejected||g.unknown?'調教原票：開催日以降除外'+g.rejected+'件／日付不明'+(g.unknown||0)+'件。':'')+'単勝：'+odds.state+'。能力確率・期待値・展開勝敗・正式疲労指数の算出は未実装。研究タグは探索用で加点・買い条件ではありません。最終馬券は全頭・最新出馬表・調教・当日オッズの独立確認までHOLD。';
}catch(err){status.textContent='HOLD：'+err.message}finally{b.disabled=false}
});
})();