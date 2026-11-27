/* V96: formal median positions and seven bet-type odds-concentration research. No calibrated chaos decision. */
(()=>{'use strict';
const $=id=>document.getElementById(id),state=$('v96Status'),out=$('v96Results');
if(!state||!out)return;
let snapshot=null,serial=0;
const key=r=>[r.date,r.venue,String(r.race_no)].join('|');
const publish=detail=>window.dispatchEvent(new CustomEvent('v96-market-summary',{detail}));
function reset(){serial++;snapshot=null;out.replaceChildren();$('v96Run').disabled=false;publish(null);}
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',reset);
window.addEventListener('v86-upcoming-import',e=>{if(e.detail?.schema==='TARGET_V86_UPCOMING_RACE_V1'){reset();snapshot=e.detail;}});
const norm=v=>String(v??'').normalize('NFKC').replace(/[　\s]+/g,'').trim();
const n=v=>{const x=String(v??'').trim();return x&&/^\d+(?:\.\d+)?$/.test(x)?Number(x):null;};
const get=(h,keys)=>{for(const k of keys){const i=h.findIndex(x=>norm(x).toLowerCase()===norm(k).toLowerCase());if(i>=0)return i;}return -1};
const tr=(table,values,header=false)=>{const r=document.createElement('tr');for(const v of values){const c=document.createElement(header?'th':'td');c.textContent=String(v);r.append(c)}table.append(r)};
function table(head,items){const t=document.createElement('table');tr(t,head,true);for(const a of items)tr(t,a);const d=document.createElement('div');d.className='scroll';d.append(t);out.append(d)}
function heading(s){const h=document.createElement('h3');h.textContent=s;out.append(h)}
function median(sorted){if(!sorted.length)return[];const i=Math.floor((sorted.length-1)/2);return sorted.length%2?[sorted[i]]:[sorted[i],sorted[i+1]]}
function nos(a){return a.length?a.map(x=>x.no+'番').join(' / '):'対象なし'}
function race(){if(!snapshot)throw Error('先にV90から全頭10走台帳を転送してください');const r=snapshot.race;if(r.date!==$('v90Date').value||r.venue!==$('v90Venue').value||String(r.race_no)!==$('v90Race').value)throw Error('選択レースと台帳が不一致。V90から転送し直してください');return r}
async function csv(file){if(!file)return null;if(!window.v87Bridge?.decodeCSV)throw Error('CSV読取エンジンがありません');let rows=await window.v87Bridge.decodeCSV(file);if(rows.length<2)throw Error('CSVにレコードがありません');return{h:rows[0].map(x=>String(x??'').replace(/^\uFEFF/,'').trim()),rows:rows.slice(1)}}
async function singles(r){
const src=await csv($('v96Single').files[0]);if(!src)return null;
const h=src.h,di=get(h,['date','開催日']),vi=get(h,['venue','競馬場']),ri=get(h,['race_no','レース番号']),hi=get(h,['horse_number','馬番']),wi=get(h,['win_odds','単勝']),pi=get(h,['place_upper','複勝上限','place_upper_odds']),ti=get(h,['captured_at','取得時刻']);
if([di,vi,ri,hi,wi,pi,ti].some(x=>x<0))throw Error('単複CSVはdate,venue,race_no,horse_number,win_odds,place_upper,captured_at が必須');
const m=new Map(),times=new Set();
for(const row of src.rows){if(String(row[di]).replace(/\//g,'-')!==r.date||norm(row[vi])!==norm(r.venue)||Number(row[ri])!==Number(r.race_no))continue;
const no=n(row[hi]),win=n(row[wi]),place=n(row[pi]),time=String(row[ti]||'').trim();
if(!Number.isInteger(no)||!win||!place||win<1||place<1||!time||m.has(no))throw Error('同一レースの馬番・単複オッズ・取得時刻が不正／重複');
m.set(no,{no,win,place});times.add(time)}
const known=new Set(r.horses.map(x=>Number(x[0])));
if(m.size!==known.size||[...m.keys()].some(k=>!known.has(k)))throw Error('出走馬全頭の単複オッズが揃っていません');
if(times.size!==1)throw Error('全頭の単複オッズ取得時刻が一致しません');
return {a:[...m.values()],time:[...times][0]};
}
function combinationKey(raw,type,known){
const text=String(raw??'').normalize('NFKC').trim();
const length=type==='単勝'||type==='複勝'?1:type==='三連複'||type==='三連単'?3:2;
if(!/^\d{1,2}(?:\s*[-→>＝=\/]\s*\d{1,2})*$/.test(text))return null;
const nums=text.split(/\s*[-→>＝=\/]\s*/).map(Number);
if(nums.length!==length||new Set(nums).size!==length||nums.some(n=>!known.has(n)))return null;
if(['馬連','ワイド','三連複'].includes(type))nums.sort((a,b)=>a-b);
return nums.join('-');
}
async function multi(r){
const src=await csv($('v96Multi').files[0]);if(!src)return null;
const h=src.h,di=get(h,['date']),vi=get(h,['venue']),ri=get(h,['race_no']),ki=get(h,['bet_type']),ci=get(h,['combination']),oi=get(h,['odds']),ti=get(h,['captured_at']);
if([di,vi,ri,ki,ci,oi,ti].some(x=>x<0))throw Error('7券種CSVにはdate,venue,race_no,bet_type,combination,odds,captured_at が必要');
const types=['単勝','複勝','馬連','馬単','ワイド','三連複','三連単'],maps=new Map(types.map(k=>[k,new Map()])),times=new Map(),invalid=new Set(),known=new Set(r.horses.map(x=>Number(x[0])));
for(const row of src.rows){if(String(row[di]).replace(/\//g,'-')!==r.date||norm(row[vi])!==norm(r.venue)||Number(row[ri])!==Number(r.race_no))continue;
const type=String(row[ki]).trim(),m=maps.get(type);if(!m)continue;
const comb=combinationKey(row[ci],type,known),odds=n(row[oi]),time=String(row[ti]||'').trim();
if(!comb||odds===null||odds<1||!time||m.has(comb)){invalid.add(type);continue;}
m.set(comb,odds);if(!times.has(type))times.set(type,new Set());times.get(type).add(time)}
return {maps,times,invalid};
}
async function run(){
const ticket=++serial;publish(null);out.replaceChildren();const b=$('v96Run');b.disabled=true;
try{
const r=race(),sourceSnapshot=snapshot;const [s,m]=await Promise.all([singles(r),multi(r)]);
if(ticket!==serial||snapshot!==sourceSnapshot||key(race())!==key(r))return;
const summary={key:key(r),single:null,multi:[],chaos:'HOLD：実証済み荒れ判定閾値なし'};
if(!s&&!m)throw Error('単複または7券種オッズCSVを選択してください');
if(s){
const win=[...s.a].sort((a,b)=>a.win-b.win||a.no-b.no),place=[...s.a].sort((a,b)=>a.place-b.place||a.no-b.no);
const p6=place.findIndex(x=>x.place>=6),p15=place.findIndex(x=>x.place>=15);
const w6=p6<0?place.length:p6,w15=p15<0?place.length:p15;
const groups=[
['単勝 赤オッズ（10倍未満）',median(win.filter(x=>x.win<10))],
['単勝 20倍以内',median(win.filter(x=>x.win<=20))],
['単勝 全頭',median(win)],
['単勝 10〜20倍',median(win.filter(x=>x.win>=10&&x.win<=20))],
['単勝 20倍超〜100倍以下',median(win.filter(x=>x.win>20&&x.win<=100))],
['複勝上限10倍以内',median(place.filter(x=>x.place<=10))],
['複勝上限1倍台',median(place.filter(x=>x.place>=1&&x.place<2))],
['P6：6倍壁前2頭を除く上位側',p6<0?[]:median(place.slice(0,Math.max(0,w6-2)))],
['P15→P6：6倍壁1頭手前〜15倍壁前2頭除外',p6<0?[]:median(place.slice(Math.max(0,w6-1),Math.max(0,w15-2)))]
];
heading('正式メジアン位置（複勝は上限値を使用）');
table(['研究区分','中央値に位置する馬番'],groups.map(([k,a])=>[k,nos(a)]));
const count=new Map();for(const [key,a] of groups){if(key.startsWith('単勝')||key.startsWith('複勝')||key.startsWith('P'))for(const x of a){if(!count.has(x.no))count.set(x.no,new Set());count.get(x.no).add(key)}}
const dup=[...count.entries()].filter(([k,v])=>v.size>=2).sort((a,b)=>b[1].size-a[1].size);
heading('メジアン重複（独立因子として加点しない）');
table(['馬番','該当する研究区分'],dup.map(([no,v])=>[no,[...v].join('／')]));
const fav=win[0],low=win.filter(x=>x.win>=3&&x.win<=5);
const inv=win.map(x=>1/x.win),sum=inv.reduce((a,b)=>a+b,0),top3=inv.slice(0,3).reduce((a,b)=>a+b,0)/sum*100;
summary.single={time:s.time,top3,red:win.filter(x=>x.win<10).length,soloFavorite:fav.win<2&&win[1]?.win>=2,cluster:low.length,favorite:{no:fav.no,odds:fav.win},placeFavorite:place[0].no,rows:win.map(x=>({no:x.no,win:x.win,place:x.place,groups:[...(count.get(x.no)||[])],cross:[...(count.get(x.no)||[])].some(k=>k.startsWith('単勝'))&&[...(count.get(x.no)||[])].some(k=>!k.startsWith('単勝'))}))};
const p=document.createElement('p');p.textContent='単勝市場参考：逆数オッズ正規化の上位3頭占有率 '+top3.toFixed(1)+'％。単独1倍台 '+(fav.win<2&&win[1]?.win>=2?'該当':'非該当')+'／3〜5倍の馬 '+low.length+'頭。時刻 '+s.time+'。これは売上シェアではなく、荒れる確率でもありません。';out.append(p);
}
if(m){
heading('7券種：オッズ分布の入力監査（参考）');
const N=r.horse_count,comb2=N*(N-1)/2,comb3=N*(N-1)*(N-2)/6;
const expected={'単勝':N,'複勝':N,'馬連':comb2,'馬単':N*(N-1),'ワイド':comb2,'三連複':comb3,'三連単':N*(N-1)*(N-2)};
const rows=[];
for(const kind of ['単勝','複勝','馬連','馬単','ワイド','三連複','三連単']){
const records=m.maps.get(kind),times=m.times.get(kind)||new Set(),complete=expected[kind]>0&&records.size===expected[kind]&&times.size===1&&!m.invalid.has(kind), odds=[...records.values()].sort((a,b)=>a-b);
let concentration='未計算';
if(complete){const inv=odds.map(x=>1/x),total=inv.reduce((a,b)=>a+b,0);concentration=(inv.slice(0,Math.min(3,inv.length)).reduce((a,b)=>a+b,0)/total*100).toFixed(1)+'%';}
summary.multi.push({kind,count:records.size,expected:expected[kind],complete,concentration,time:times.size===1?[...times][0]:null});
rows.push([kind,records.size+'/'+expected[kind],times.size===1?[...times][0]:'混在・なし',complete?'組合せ一致※':m.invalid.has(kind)?'不正・重複 HOLD':'不足・HOLD',concentration]);}
table(['券種','入力点数/理論点数','取得時刻','件数監査','上位3組逆数占有率'],rows);
const note=document.createElement('p');note.className='warn';note.textContent='※全組合せ・重複・時刻一致を検査。取消、同着、発売条件、複勝・ワイドのレンジオッズ、オッズ刻みは未監査。7券種横断の「荒れる／堅い」の実証済み閾値は未設定。';out.append(note);
}
state.textContent='V96のオッズ研究画面を表示。メジアンはオッズ昇順の中央馬（偶数時2頭）、P6とP15は正式壁定義に従います。壁不成立は候補なし。異券種の逆数占有率は売上比率ではなく、荒れ確率・期待値・購入推奨には使用しません。全頭10走・調教・直前情報の最終監査まで買い目HOLD。';
publish(summary);
}catch(e){if(ticket===serial){state.textContent='HOLD：'+e.message;publish(null);}}finally{if(ticket===serial)b.disabled=false}
}
window.v96Market={run};$('v96Run').addEventListener('click',run);
})();