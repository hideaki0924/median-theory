/* V92 official training factor adapter; browser-only; no persistent storage. */
(()=>{'use strict';
const $=id=>document.getElementById(id), out=$('v92Results'),stat=$('v92Status');
if(!out||!stat)return;
const norm=x=>String(x??'').normalize('NFKC').replace(/[\s　]+/g,'').trim(), lap=x=>{const t=String(x??'').trim();return /^\d+(\.\d+)?$/.test(t)?Number(t):null;};
const fields=['DUAL_END','SUSTAINED_DRIVE','LONG_SUSTAIN','HIDDEN_KICK'];
const idAliases=['馬名','horse_name','horse','name'];
const dateAliases=['調教日','日付','年月日','date','workout_date'];
const c=(headers,keys)=>{for(const x of keys){let i=headers.findIndex(y=>norm(y).toUpperCase()===norm(x).toUpperCase());if(i>=0)return i;}return -1;};
function dateISO(x){const s=String(x??'').trim();let m=s.match(/^(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');m=s.match(/^(\d{4})(\d{2})(\d{2})$/);return m?m[1]+'-'+m[2]+'-'+m[3]:'';}
function horses(){return [...new Map(($('v88Lineup')?.value||'').split(/\r?\n/).map(l=>l.split(/[,\t]/)).filter(a=>a.length===2&&/^\d+$/.test(a[0])&&a[1].trim()).map(a=>[norm(a[1]),{no:Number(a[0]),name:a[1].trim()}])).values()].sort((a,b)=>a.no-b.no);}
async function load(file){if(!file)return null;if(!window.v87Bridge?.decodeCSV)throw Error('V87 CSV読み込みエンジンが必要です');const rows=await window.v87Bridge.decodeCSV(file);if(rows.length<2)throw Error(file.name+' のレコードが不足');const h=rows[0].map(x=>String(x??'').trim().replace(/^\uFEFF/,''));return {rows:rows.slice(1),h};}
function bool(x){const s=norm(x).toUpperCase();return ['1','TRUE','YES','Y','○','〇','該当'].includes(s);}
function cell(tr,v){const td=document.createElement('td');td.textContent=v;tr.append(td);}
function twinMetrics(x,y){return Math.sqrt(.2*(x[0]-y[0])**2+.5*(x[1]-y[1])**2+1*(x[2]-y[2])**2+1.2*(x[3]-y[3])**2);}
function getLaps(h,row){const ls=[['L4','lap4','ラップ4'],['L3','lap3','ラップ3'],['L2','lap2','ラップ2'],['L1','lap1','ラップ1']].map(keys=>{const i=c(h,keys);return i<0?null:lap(row[i]);});return ls.every(v=>v!==null)?ls:null;}
async function run(){
const btn=$('v92Run');btn.disabled=true;out.replaceChildren();stat.textContent='正式SOURCEフラグと双子原点式を監査中…';
try{
const cutoff=$('v90Date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))throw Error('開催日が不正です');
if($('v88Date')?.value!==$('v90Date')?.value||$('v88Venue')?.value!==$('v90Venue')?.value||Number($('v88RaceNo')?.value)!==Number($('v90Race')?.value))throw Error('出馬表のレースが現在のV90選択と一致しません。対象レースを再転送してください');
const hs=horses();if(hs.length<2)throw Error('先にV90の出馬表を読み込んでください');
const official=await load($('v92Official').files[0]);if(!official)throw Error('正式SOURCEから書き出した調教フラグCSVを選んでください');
const hi=c(official.h,idAliases),di=c(official.h,dateAliases),fi=fields.map(f=>c(official.h,[f]));
if(hi<0||di<0||fi.some(i=>i<0))throw Error('正式SOURCEに必須列が不足。必要：馬名・調教日・'+fields.join('・'));
const flags=new Map();let excluded=0,invalidDate=0;
for(const r of official.rows){const name=norm(r[hi]),d=dateISO(r[di]);if(!name)continue;if(!d){invalidDate++;continue;}if(d>=cutoff){excluded++;continue;}
if(!flags.has(name))flags.set(name,{dates:[],flags:[false,false,false,false]});const v=flags.get(name);v.dates.push(d);fi.forEach((i,j)=>{if(bool(r[i]))v.flags[j]=true;});}
let references=null,refExcluded=0;
if($('v92Twin').files[0]){
const source=await load($('v92Twin').files[0]);const nameIndex=c(source.h,idAliases),dateIndex=c(source.h,dateAliases);
if(nameIndex<0||dateIndex<0||!getLaps(source.h,source.h.map(()=>0))){const missing=['L4','L3','L2','L1'].filter(k=>c(source.h,[k,'lap'+k.slice(1)])<0);if(missing.length)throw Error('双子比較CSVにはL4〜L1の実測ラップが必要');}
references=[];
for(const r of source.rows){const d=dateISO(r[dateIndex]);if(!d){continue;}if(d>=cutoff){refExcluded++;continue;}const laps=getLaps(source.h,r);if(laps)references.push({name:norm(r[nameIndex]),date:d,laps,reference:bool(r[c(source.h,['GOOD_RUN_REFERENCE','好走調教基準'])])});}
}
const table=document.createElement('table'),thead=document.createElement('tr');['馬番','馬名','DUAL','SUST','LONG','HIDDEN','双子D（参考）','SOURCE監査'].forEach(t=>{const th=document.createElement('th');th.textContent=t;thead.append(th);});table.append(thead);
let found=0,twins=0;
for(const h of hs){const tr=document.createElement('tr'),record=flags.get(norm(h.name));cell(tr,String(h.no));cell(tr,h.name);
if(record){found++;record.flags.forEach(v=>cell(tr,v?'該当':'非該当'));}else{fields.forEach(()=>cell(tr,'未確認'));}
let d='基準なし';
if(references){const same=references.filter(r=>r.name===norm(h.name));const base=references.filter(r=>r.reference&&r.name!==norm(h.name));if(same.length&&base.length){const vals=[];for(const x of same)for(const y of base)vals.push(twinMetrics(x.laps,y.laps));d=Math.min(...vals).toFixed(3)+'（参考最小距離）';twins++;}else d='比較対象不足';}
cell(tr,d);cell(tr,record?'正式フラグを転記':'HOLD：該当原票なし');table.append(tr);}
const wrapper=document.createElement('div');wrapper.className='scroll';wrapper.append(table);out.append(wrapper);
stat.textContent='正式調教原票 '+found+'/'+hs.length+'頭照合。発走日以降の原票 '+excluded+'件除外、日付不明 '+invalidDate+'件除外。双子D計算 '+twins+'頭（比較基準必須）、参考Dは正式閾値判定ではありません。正式SOURCE内の4黄金フラグを維持。全頭10走・市場・当日馬場との総合判定は未完了、買い目HOLD。';
}catch(e){stat.textContent='HOLD：'+e.message;}finally{btn.disabled=false;}
}
$('v92Run').addEventListener('click',run);
})();