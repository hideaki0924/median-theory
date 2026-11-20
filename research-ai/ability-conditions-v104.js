/* V104 | Comparable-race ability evidence; raw times are compared ONLY within identical venue/surface/distance/going. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v104Status'),root=$('v104Results');
if(!status||!root)return;
let source=null;
const key=r=>[r?.date,r?.venue,String(r?.race_no)].join('|');
const current=()=>[$('v90Date')?.value,$('v90Venue')?.value,String($('v90Race')?.value)].join('|');
window.addEventListener('v86-upcoming-import',e=>{const v=e.detail;if(v?.schema==='TARGET_V86_UPCOMING_RACE_V1'&&key(v.race)===current()){source=v;root.replaceChildren();status.textContent='同一レースの正式ID照合済み過去走を受信しました。';}});
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',()=>{source=null;root.replaceChildren();status.textContent='HOLD：レース変更。能力比較をクリアしました。';});
const val=x=>{if(x===undefined||x===null||String(x).trim()==='')return null;const n=Number(x);return Number.isFinite(n)?n:null;};
const str=x=>String(x??'').trim();
const text=(tag,content)=>{const e=document.createElement(tag);e.textContent=content??'';return e;};
function cell(row,x,head=false){row.append(text(head?'th':'td',String(x)));}
function table(headers,rows){const outer=text('div');outer.className='scroll';const t=text('table');let head=text('tr');headers.forEach(h=>cell(head,h,true));t.append(head);for(const a of rows){const row=text('tr');a.forEach(v=>cell(row,v));t.append(row);}outer.append(t);root.append(outer);}
function cls(s){s=str(s).normalize('NFKC').replace(/\s/g,'');if(/新馬/.test(s))return '新馬';if(/未勝利/.test(s))return '未勝利';for(const n of [1,2,3])if(s.includes(n+'勝'))return n+'勝クラス';if(/G1|GI|GⅠ/.test(s))return 'G1';if(/G2|GII|GⅡ/.test(s))return 'G2';if(/G3|GIII|GⅢ/.test(s))return 'G3';return s||'未特定';}
function describe(h,fields,race){
if(!Array.isArray(h[8])||h[8].length>10)throw Error('過去走数不正：'+h[1]);
const races=h[8].map((row,i)=>{if(!Array.isArray(row)||row.length!==fields.length)throw Error('過去走列数不一致：'+h[1]);return Object.fromEntries(fields.map((name,j)=>[name,row[j]]));}).sort((a,b)=>str(b.date).localeCompare(str(a.date)));
if(races.some(x=>!x.date||x.date>=race.date||x.source_status!=='STRICT_ID_MATCH'))throw Error('未来走・未照合過去走を検出：'+h[1]);
const finishOK=x=>{const n=val(x.finish_position);return n!==null&&n>=1&&n<=28;};
const sameSurface=races.filter(x=>str(x.surface)===str(race.surface));
const sameDist=sameSurface.filter(x=>val(x.distance_m)===val(race.distance_m));
const exact=sameDist.filter(x=>str(x.racecourse)===str(race.venue));
const byGoing=new Map();for(const r of exact){const going=str(r.going);if(!going)continue;if(!byGoing.has(going))byGoing.set(going,[]);byGoing.get(going).push(r);}
const timeGroup=[...byGoing.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]))[0];
const candidateTime=timeGroup?timeGroup[1].filter(x=>finishOK(x)&&val(x.finish_time_seconds)!==null&&val(x.finish_time_seconds)>0):[];
const candidateL3=timeGroup?timeGroup[1].filter(x=>finishOK(x)&&val(x.last3f_seconds)!==null&&val(x.last3f_seconds)>0):[];
const winnerTime=candidateTime.length?Math.min(...candidateTime.map(x=>val(x.finish_time_seconds))):null;
const l3Time=candidateL3.length?Math.min(...candidateL3.map(x=>val(x.last3f_seconds))):null;
const properMargins=sameDist.filter(x=>finishOK(x)&&val(x.margin_sec)!==null).map(x=>Math.max(0,val(x.margin_sec)));
const bestMargin=properMargins.length?Math.min(...properMargins):null;
const top3=arr=>arr.filter(x=>finishOK(x)&&val(x.finish_position)<=3).length;
const clsMap=new Map();for(const r of races){const c=cls(r.class_name),a=clsMap.get(c)||{n:0,top3:0};a.n++;if(finishOK(r)&&val(r.finish_position)<=3)a.top3++;clsMap.set(c,a);}
const observations=[];
if(sameDist.length)observations.push('同芝ダ同距離'+sameDist.length+'走');
if(top3(sameDist))observations.push('同距離で3着内'+top3(sameDist)+'走');
if(top3(exact))observations.push('同競馬場同距離で3着内'+top3(exact)+'走');
if([...clsMap.values()].some(z=>z.top3))observations.push('クラス別3着内の実測あり');
return {runs:races.length,sameDist:sameDist.length,sameTop3:top3(sameDist),exact:exact.length,exactTop3:top3(exact),bestMargin,winningTime:winnerTime,last3f:l3Time,going:timeGroup?.[0]||'',timeCount:candidateTime.length,clsMap,observations,fullCareer:h[9]?.completeness_confirmed===true,has10:races.length===10,sourceState:String(h[3])};
}
$('v104Run').addEventListener('click',()=>{
root.replaceChildren();
try{
const v=source;if(!v||key(v.race)!==current())throw Error('先にV90で同一レースのTARGET走歴を転送してください');
const r=v.race;if(r.horses.length!==r.horse_count)throw Error('全頭数の不一致');
const need=['date','distance_m','finish_position','racecourse','class_name','going','margin_sec','finish_time_seconds','last3f_seconds','surface','source_status'];
if(need.some(k=>!v.past_fields?.includes(k)))throw Error('必須過去走列が不足');
const data=[...r.horses].sort((a,b)=>a[0]-b[0]).map(h=>({h,s:describe(h,v.past_fields,r)}));
const raceRows=[],classRows=[];let holds=0,exactTime=0;
for(const {h,s} of data){
if(!s.has10&&!s.fullCareer)holds++;
if(s.winningTime!==null)exactTime++;
const label=s.going?'過去の'+s.going+'（'+s.timeCount+'走）':'馬場別比較なし';
raceRows.push([h[0]+' '+h[1],s.runs+'走',s.sameTop3+'/'+s.sameDist,s.exactTop3+'/'+s.exact,s.bestMargin===null?'―':s.bestMargin.toFixed(2),s.winningTime===null?'比較不可':s.winningTime.toFixed(1)+'秒',s.last3f===null?'比較不可':s.last3f.toFixed(1)+'秒',label,s.observations.join('／')||'条件合致なし',s.has10?'10走形式照合':s.fullCareer?'全キャリア外部確認':'HOLD：全キャリア未確定']);
for(const [clsName,c] of s.clsMap)classRows.push([h[0]+' '+h[1],clsName,c.n,c.top3]);
}
root.append(text('h3','同条件の能力実績（全頭）'));
table(['馬番・馬名','履歴','同芝ダ同距離3着内','同競馬場同距離3着内','同距離好走時最小着差秒','同場・同芝ダ・同距離・同馬場の最速走破','同一条件の最速上り','比較に使った過去馬場','材料','監査状態'],raceRows);
root.append(text('h3','クラス別の出走・好走履歴（記録上のクラス名）'));
table(['馬番・馬名','クラス（過去走）','出走','3着内'],classRows);
status.textContent=r.date+' '+r.venue+r.race_no+'R：'+data.length+'頭を検査。厳密同条件時計の計測あり '+exactTime+'頭／10走未満の全キャリア追加確認 '+holds+'頭。時計は各馬の過去走にある同一コース・芝ダ・距離・馬場状態の最速記録。馬ごとに比較に使った馬場状態が異なれば直接の優劣比較は禁止。今回の馬場状態が未入力なら当日馬場適性は未判定。クラス上昇・下降の厳密な強さ換算、基準タイム、斤量差、トラックバイアス補正、勝率・期待値は未検証。買い目HOLD。';
}catch(e){status.textContent='HOLD：'+e.message;}
});
})();