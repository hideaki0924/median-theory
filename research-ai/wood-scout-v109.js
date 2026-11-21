/* V109: frozen WOOD SCOUT V0.10 whole-population replay from private bundle. */
(()=>{'use strict';
const $=id=>document.getElementById(id), norm=x=>String(x??'').normalize('NFKC').replace(/[\s　]+/g,'').trim();
const truth=v=>['1','TRUE','YES','該当'].includes(norm(v).toUpperCase());
const date=x=>{const m=String(x??'').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);return m?m.slice(1).join('-'):''};
const flags=['DUAL_END','HIDDEN_KICK','SUSTAINED_DRIVE','LONG_SUSTAIN'];
let latest=null,ref=null;
async function load(cutoff){
const file=$('v109Scout')?.files?.[0];
if(!file)return {present:false,byId:new Map()};
if(ref===file&&latest)return latest;
if(!window.v87Bridge?.decodeCSV)throw Error('WOOD SCOUT CSV解析不可');
const csv=await window.v87Bridge.decodeCSV(file);
if(!csv.length)throw Error('WOOD SCOUT CSVヘッダーなし');
const head=csv[0].map(v=>norm(v).replace(/^\uFEFF/,''));
const required=['血統登録番号','馬名','調教師','調教日','4F','1F','MAIN_WORKDAY','判定ルール',...flags],ix={};
for(const k of required){ix[k]=head.indexOf(norm(k));if(ix[k]<0)throw Error('WOOD SCOUT固定列が不足：'+k)}
const byId=new Map();
for(const row of csv.slice(1)){
const id=String(row[ix['血統登録番号']]??'').trim(),day=date(row[ix['調教日']]);
if(!/^\d{10}$/.test(id)||!day||day>=cutoff)continue;
if(String(row[ix['判定ルール']])!=='WOOD_SCOUT_V010_FIXED_RULE_REPLAY')throw Error('WOOD SCOUTのSOURCE不一致');
const v={name:norm(row[ix['馬名']]),trainer:norm(row[ix['調教師']]),date:day,
  four:Number(row[ix['4F']]),one:Number(row[ix['1F']]),main:truth(row[ix['MAIN_WORKDAY']]),
  flags:flags.filter(k=>truth(row[ix[k]]))};
if(!v.name||!v.trainer||!Number.isFinite(v.four)||!Number.isFinite(v.one)||v.four<=0||v.one<=0)throw Error('WOOD SCOUT原票の馬ID・時計が不正');
const records=byId.get(id)||[];records.push(v);byId.set(id,records);
}
for(const v of byId.values())v.sort((a,b)=>b.date.localeCompare(a.date));
ref=file;latest={present:true,byId};return latest;
}
function forHorse(data,h){
if(!data.present)return {matched:false,positive:false,label:'11/15・17・18・19日固定式再計算SOURCE未入力（陰性ではない）'};
const rows=(data.byId.get(String(h[2]))||[]).filter(x=>x.name===norm(h[1])&&x.trainer===norm(h[9]?.trainer));
if(!rows.length)return {matched:false,positive:false,label:'対象4日間のウッド原票に馬ID・馬名・厩舎一致なし（陰性未確定）'};
const texts=rows.map(x=>x.date+'：'+(x.flags.join('／')||'4型非該当')+'／4F '+x.four.toFixed(1)+'／1F '+x.one.toFixed(1)+'／MAIN '+(x.main?'成立':'不成立'));
return {matched:true,positive:rows.some(x=>x.flags.length>0),label:texts.join('\n')+'\n全原票のWOOD SCOUT V0.10固定式を再適用。10/31〜11/13の確定済み黄金SOURCEとは区別。'};
}
window.v109Scout={load,forHorse};
})();