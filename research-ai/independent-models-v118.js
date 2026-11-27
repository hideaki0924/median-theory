/* V118 partial independent research adapters.
Sources: 見える男_実戦版_V1.0_仕様書.md; 50CSV_4モデル強化監査_V0.1.md;
スレイプニル_監査版_V0.90_仕様書.md; 直結BP_V0.54_OPERATION_FROZEN.xlsx.
No weights, inferred lap/rank, or automatic HEAD. */
(()=>{'use strict';
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const num=x=>x==null||String(x).trim()===''?null:Number.isFinite(Number(x))?Number(x):null;
function cls(x){const s=norm(x);if(/^(新馬|未勝利)$/.test(s))return s;
for(const [rx,v] of [[/^(1勝(クラス)?|500万(下|条件)?)$/,'1勝'],[/^(2勝(クラス)?|1000万(下|条件)?)$/,'2勝'],[/^(3勝(クラス)?|1600万(下|条件)?)$/,'3勝'],[/^(G1|GI)$/,'G1'],[/^(G2|GII)$/,'G2'],[/^(G3|GIII)$/,'G3'],[/^(OP|オープン|OP特別)$/,'OP'],[/^(L|リステッド|OP\(L\))$/,'L']])if(rx.test(s))return v;return null;}
const surface=x=>({芝:'芝',ダ:'ダ',ダート:'ダ'})[norm(x)]||null;
const all=xs=>xs.some(x=>x===false)?false:xs.every(x=>x===true)?true:null;
const exists=(xs,covered)=>xs.some(x=>x===true)?true:covered&&xs.every(x=>x===false)?false:null;
function rows(h,fields,r){if(!Array.isArray(h[8])||h[8].length>10||new Set(fields).size!==fields.length)throw Error('走歴形式異常');const seen=new Set();return h[8].map(p=>{if(!Array.isArray(p)||p.length!==fields.length)throw Error('走歴列異常');const x=Object.fromEntries(fields.map((k,i)=>[k,p[i]]));if(!/^\d{4}-\d\d-\d\d$/.test(String(x.date))||x.date>=r.date||x.source_status!=='STRICT_ID_MATCH'||!x.race_id||seen.has(x.race_id))throw Error('走歴日付・ID異常');seen.add(x.race_id);return x;}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.race_id).localeCompare(String(a.race_id)));}
function margin(x,limit){const p=num(x.finish_position),m=num(x.margin_sec);if(p===null||!Number.isInteger(p)||p<1||m===null||p>1&&m<0)return null;return m<=limit+1e-12;}
function equal(a,b){return a==null||b==null||a===''||b===''?null:a===b;}
function evidence(h,fields,r){const hist=rows(h,fields,r),complete=h[9]?.completeness_confirmed===true,covered=k=>hist.length>=k||complete,cl=cls(r.class_name),sd=surface(r.surface),dist=num(r.distance_m),venue=norm(r.venue);
const same=x=>equal(cls(x.class_name),cl);
const c5=hist.slice(0,5).map(x=>all([same(x),margin(x,.5)]));
const t2=hist.slice(0,2).map(x=>all([same(x),margin(x,1)]));
const near=hist.slice(0,8).map(x=>all([equal(norm(x.racecourse),venue),equal(surface(x.surface),sd),num(x.distance_m)===null||dist===null?null:Math.abs(num(x.distance_m)-dist)<=200,margin(x,1)]));
const CLASS05=exists(c5,covered(5)),TIMEHOLD2=t2.length===2?all(t2):complete?false:null,NEAR10=exists(near,covered(8));
const last=hist[0],rank=num(last?.last3f_rank),finish=num(last?.finish_position),gap=last?Math.round((Date.parse(r.date+'T00:00:00Z')-Date.parse(last.date+'T00:00:00Z'))/86400000):null;
const lateBase=last?all([finish===null||!Number.isInteger(finish)||finish<1?null:finish>=8,margin(last,1),rank===null||!Number.isInteger(rank)||rank<1?null:rank<=3]):complete?false:null;
return Object.freeze({no:Number(h[0]),history:hist.length,CLASS05,TIMEHOLD2,NEAR10,E3:all([CLASS05,TIMEHOLD2,NEAR10]),lateBase,gap,rest:gap===null?null:gap<=21||gap>=36&&gap<=70,hasRank:rank!==null,complete});}
function marketAfter(ability,market){const a=market?.rows;if(!Array.isArray(a)||!a.length||a.some(x=>num(x.win)===null||x.win<1))return {rank:null,E3hole:null,LATEA:null,LATE7R:null};const row=a.find(x=>x.no===ability.no);if(!row)return {rank:null,E3hole:null,LATEA:null,LATE7R:null};
const rank=a.filter(x=>x.win<row.win).length+1,tie=a.filter(x=>x.win===row.win).length>1,position=tie?null:rank;
const E3hole=all([ability.E3,position===null?null:position>=7]);const LATEA=all([ability.lateBase,position===null?null:position>=7&&position<=9]);const LATE7R=all([LATEA,position===null?null:position===7,ability.rest]);return {rank:position,E3hole,LATEA,LATE7R};}
function courseGate(r){const k=norm(r.venue)+surface(r.surface)+num(r.distance_m);return ['中京ダ1200','中京ダ1400','新潟芝2200','中山芝2200'].includes(k)?'対象・CORE/S/A正式台帳待ち':'対象外';}
window.v118Models=Object.freeze({evidence,marketAfter,courseGate});
})();