/* Browser port of saved yasui_v1_0_engine.py and JRA V1.0 workbook RULES.
 Partial history is explicitly reference-only; odds/COMPI never enter ability.
 No 3F inference, no new weights. */
(()=>{'use strict';
const norm=x=>String(x??'').normalize('NFKC').trim();
const n=x=>x==null||String(x).trim()===''?null:Number.isFinite(Number(x))?Number(x):null;
const rnd=x=>Math.round((x+Number.EPSILON)*100)/100;
const CLASS={'新馬':0,'未勝利':0,'1勝':.1,'500万':.1,'2勝':.2,'1000万':.2,'3勝':.3,'1600万':.3,'オープン':.4,'OP(L)':.4,'G3':.5,'G2':.6,'G1':.7};
const AGE={'2歳':-.2,'3歳':-.1,'3上':0,'4上':0};
const TRACK={'芝':{'良':0,'稍':.4,'重':.8,'不':1.2},'ダ':{'良':0,'稍':-.4,'重':-.8,'不':-1.2}};
const BASE={'芝':{1200:45.8,1300:46.3,1400:46.8,1500:47.3,1600:47.6,1800:48.8,2000:49.2,2200:49.9,2300:49.9,2400:49.9,2500:49.6,2600:50.1,2800:50.4,3000:50.4,3200:50.5,3400:50.5,3600:50.5},'ダ':{1000:47.5,1150:48.1,1200:48.8,1300:49.3,1400:49.4,1600:49.9,1700:50.5,1800:50.8,1900:50.7,2000:50.6,2100:51.1,2400:51.4,2500:51.1}};
function calculate(x){
 const s=norm(x.surface),f=n(x.finish),gap=f===1?0:n(x.margin);
 const text=String(x.laps??'').trim(),laps=/^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)*$/.test(text)?text.split('-').map(Number):[];
 const valid=!!TRACK[s]&&Number.isInteger(f)&&f>=1&&laps.every(v=>v>0);
 const sum=k=>valid&&laps.length>=k?rnd(laps.slice(-k).reduce((a,b)=>a+b,0)):null;
 const l1=sum(1),l2=sum(2),l4=sum(4),c=CLASS[norm(x.class_name)],a=AGE[norm(x.age_limit)],t=TRACK[s]?.[norm(x.going)],d=BASE[s]?.[n(x.distance_m)];
 const g=gap!==null&&gap>=0&&valid;
 return {stamina:valid&&(f===1||f===2)&&l1!==null&&c!==undefined&&a!==undefined?rnd(l1+c+a):null,speed:g&&l2!==null?rnd(l2+gap):null,power:g&&l4!==null&&t!==undefined&&d!==undefined?rnd(48+l4+gap-t-d):null};
}
function sourceValid(x,p){
 if(x.source==='YASUI_JRA_V1_0_HISTORY_20260830')return x.date<='2026-08-30';
 if(x.source!=='JRA_OFFICIAL_RESULT_V123'||x.match_method!=='TARGET_RUNNER_ID+JRA_RACE_KEY+NAME_NUMBER_FINISH+WINNER_TIME')return false;
 const rid=String(x.race_id),dt=x.date.replace(/-/g,'');
 if(!/^\d{18}$/.test(rid)||rid.slice(0,8)!==dt)return false;
 const expected=rid.slice(8,10)+dt.slice(0,4)+rid.slice(10,16)+dt;
 const urlCode=String(x.source_url||'').match(/^https:\/\/(?:app|sp|own)\.jra\.jp\/JRADB\/accessS\.html\?CNAME=sw01sde(?:01|10)(\d{20})\/[A-Fa-f0-9]{2}$/);
 if(!urlCode||urlCode[1]!==expected||x.going!==p.going||x.class_name!==p.class_name)return false;
 const laps=String(x.laps||'').split('-').map(Number),gap=n(p.margin_sec),time=n(p.finish_time_seconds);
 return n(x.distance_m)>0&&laps.length===Math.ceil(n(x.distance_m)/200)&&laps.every(v=>Number.isFinite(v)&&v>0)&&gap!==null&&time!==null&&Math.abs(laps.reduce((a,b)=>a+b,0)-(time-Math.max(0,gap)))<.051;
}
function evaluate(h,fields,r){
 const m=h[9]||{},z=m.yasui_v120,ff=m.full_history_fields||fields,raw=m.full_history||h[8]||[],seen=new Set();
 if(!Array.isArray(ff)||!Array.isArray(raw)||new Set(ff).size!==ff.length)throw Error('全走歴形式不正');
 const hist=raw.map(p=>{if(!Array.isArray(p)||p.length!==ff.length)throw Error('全走歴列不正');const x=Object.fromEntries(ff.map((k,i)=>[k,p[i]]));if(!x.race_id||seen.has(x.race_id)||x.source_status!=='STRICT_ID_MATCH'||!/^\d{4}-\d\d-\d\d$/.test(x.date)||x.date>=r.date)throw Error('全走歴ID・日付不正');seen.add(x.race_id);return x;}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.race_id).localeCompare(String(a.race_id)));
 const s=norm(r.surface),age=n(m.age),map=new Map();
 for(const x of z?.rows||[]){
  const prior=hist.find(p=>p.race_id===x.race_id);
  if(!prior||map.has(x.race_id)||String(x.horse_id)!==String(h[2])||x.date!==prior.date||x.source_status!=='STRICT_ID_MATCH'||x.surface!==prior.surface||n(x.distance_m)!==n(prior.distance_m)||n(x.finish)!==n(prior.finish_position)||!sourceValid(x,prior))throw Error('安井ラップ照合不正');
  if(n(x.margin)!==n(prior.margin_sec))throw Error('安井着差不一致');
  map.set(x.race_id,{...x,...calculate(x)});
 }
 const pool=hist.map(x=>map.get(x.race_id)||null);
 const older=age!==null&&age>=4,young=age!==null&&age>=2&&age<=3;
 const same=pool.filter(x=>x?.surface===s),speedPool=young?pool:older?pool.slice(0,4):[];
 function best(rows,k,max){const a=rows.filter(x=>x&&x[k]!==null).sort((a,b)=>max?b[k]-a[k]:a[k]-b[k]);return a.length?{value:a[0][k],date:a[0].date,race_id:a[0].race_id}:null;}
 const st=best(same,'stamina',true),sp=best(speedPool.filter(x=>x?.surface===s),'speed',false),pw=best(same,'power',false);
 const complete=m.completeness_confirmed===true&&hist.length===map.size;
 const speedComplete=young?complete:older&&(hist.length>=4||m.completeness_confirmed===true)&&hist.slice(0,4).every(x=>x.surface!==s||map.get(x.race_id)?.speed!=null);
 const sameHist=hist.filter(x=>x.surface===s);
 const reasons={stamina:st?'':!sameHist.length?'同面歴なし':!sameHist.some(x=>[1,2].includes(n(x.finish_position)))?'同面1・2着歴なし（収録内）':'1F・補正未照合',speed:sp?'':!sameHist.length?'同面歴なし':!young&&!older?'年齢未確認':'2F未照合',power:pw?'':!sameHist.length?'同面歴なし':'4F・基準未照合'};
 return {no:Number(h[0]),age,history:hist.length,matched:map.size,stamina:st,speed:sp,power:pw,reasons,staminaOther:st?null:best(pool,'stamina',true),speedOther:sp?null:best(speedPool,'speed',false),complete,speedComplete,missing:hist.length-map.size,source:z?.source||'未入力',status:'HOLD：全戦歴・最新ラップ・コース★・総合印未確定'};
}
function rank(rows){for(const key of ['stamina','speed','power']){const valid=rows.filter(x=>x?.[key]).sort((a,b)=>key==='stamina'?b[key].value-a[key].value:a[key].value-b[key].value);let prev=null,rank=0;valid.forEach((x,i)=>{if(x[key].value!==prev)rank=i+1;prev=x[key].value;x[key+'Rank']=valid.length>=2?rank:null;x[key+'N']=valid.length;});}return rows;}
window.v120Yasui=Object.freeze({calculate,evaluate,rank});
})();