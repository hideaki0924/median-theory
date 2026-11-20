/* V105 pre-race condition-change evidence; descriptive only. */
(()=>{'use strict';
const $=id=>document.getElementById(id),st=$('v105Status'),out=$('v105Results');if(!st||!out)return;
let source=null;
const norm=x=>String(x??'').normalize('NFKC').trim();
const n=x=>{if(x===null||x===undefined||String(x).trim()==='')return null;const z=Number(x);return Number.isFinite(z)?z:null};
const key=r=>[r?.date,r?.venue,String(r?.race_no)].join('|');
const chosen=()=>[$('v90Date')?.value,$('v90Venue')?.value,String($('v90Race')?.value)].join('|');
const mk=(t,s='')=>{const e=document.createElement(t);e.textContent=String(s);return e};
const row=(t,values,head=false)=>{const r=mk('tr');for(const v of values)r.append(mk(head?'th':'td',v));t.append(r)};
window.addEventListener('v86-upcoming-import',e=>{const x=e.detail;if(x?.schema==='TARGET_V86_UPCOMING_RACE_V1'&&x.race&&key(x.race)===chosen()){source=x;out.replaceChildren();st.textContent='同一レースの過去走を受信。条件変更の材料を監査できます。';}});
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',()=>{source=null;out.replaceChildren();st.textContent='HOLD：レース変更。前の条件適性分析を消去しました。';});
function level(x){
const s=norm(x).replace(/\s/g,'');
if(/新馬/.test(s))return [0,'新馬'];if(/未勝利/.test(s))return[1,'未勝利'];
if(/1勝クラス|500万下|500万条件/.test(s))return[2,'1勝クラス'];
if(/2勝クラス|1000万下|1000万条件/.test(s))return[3,'2勝クラス'];
if(/3勝クラス|1600万下|1600万条件/.test(s))return[4,'3勝クラス'];
return [null,s||'不明'];
}
function history(h,fields,date){
if(!Array.isArray(h[8])||h[8].length>10)throw Error(h[1]+'：過去走数不正');
const seen=new Set();
return h[8].map(values=>{
if(!Array.isArray(values)||values.length!==fields.length)throw Error(h[1]+'：過去走列不一致');
const x=Object.fromEntries(fields.map((k,i)=>[k,values[i]]));
if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date))||x.date>=date||x.source_status!=='STRICT_ID_MATCH'||seen.has(x.race_id))throw Error(h[1]+'：日付・識別ID不一致');
seen.add(x.race_id);return x;
}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.race_id).localeCompare(String(a.race_id)));
}
function count(rows,pred){const a=rows.filter(pred);return {total:a.length,top3:a.filter(x=>{const p=n(x.finish_position);return p!==null&&p>=1&&p<=3}).length};}
function audit(h,fields,race){
const hist=history(h,fields,race.date),last=hist[0],ld=n(last?.distance_m),dist=n(race.distance_m);
const movement=ld===null||dist===null?'前走距離不明':dist<ld?'距離短縮 '+(ld-dist)+'m':dist>ld?'距離延長 '+(dist-ld)+'m':'同距離';
const condition=x=>norm(x.surface)===norm(race.surface)&&n(x.distance_m)===dist;
const sd=count(hist,condition),track=count(hist,x=>condition(x)&&norm(x.racecourse)===norm(race.venue));
const prev=level(last?.class_name),now=level(race.class_name||race.race_name);
const clazz=prev[0]===null||now[0]===null?'クラス比較保留':now[0]<prev[0]?'前走比クラス下降（名称分類）':now[0]>prev[0]?'前走比クラス上昇（名称分類）':'前走比同クラス帯（名称分類）';
const recent=hist.slice(0,5),poor=recent.length>0&&recent.filter(x=>{const p=n(x.finish_position);return p!==null&&p>=6}).length>=Math.ceil(recent.length/2);
const grounds=new Map();
for(const x of hist.filter(condition)){const g=norm(x.going);if(!g)continue;if(!grounds.has(g))grounds.set(g,{count:0,top3:0});const v=grounds.get(g);v.count++;const p=n(x.finish_position);if(p!==null&&p>=1&&p<=3)v.top3++;}
const tips=[];if(poor&&sd.top3)tips.push('近5走凡走多め・今回同距離の好走歴');if(track.top3)tips.push('今回同場同距離の好走歴');if(clazz.startsWith('前走比クラス下降'))tips.push('前走比クラス下降');if(grounds.size)tips.push('同距離馬場別実績');
const prior=last?[last.date,last.racecourse,last.surface,String(ld??'?')+'m',String(last.finish_position||'?')+'着',prev[1]].join(' '):'過去出走なし';
return {runs:hist.length,prior,movement,clazz,sd,track,grounds:[...grounds].map(([k,v])=>k+':'+v.top3+'/'+v.count).join('、')||'不明',tips,poor,complete:hist.length===10||h[9]?.completeness_confirmed===true};
}
$('v105Run').addEventListener('click',()=>{
out.replaceChildren();
try{
const x=source,r=x?.race;if(!r||key(r)!==chosen())throw Error('V90から同一レースのTARGET走歴を転送してください');
if(r.horses.length!==r.horse_count)throw Error('全頭数不一致');
const cols=['date','distance_m','finish_position','racecourse','surface','going','class_name','source_status','race_id'];
if(cols.some(c=>!x.past_fields?.includes(c)))throw Error('TARGET必須走歴列不足');
const table=mk('table');row(table,['馬番・馬名','前走','今回の距離変更','クラス変更','同距離3着内','同競馬場同距離3着内','同距離・馬場別','巻き返し材料','監査'],true);
let positive=0,poor=0,missing=0;
for(const h of [...r.horses].sort((a,b)=>a[0]-b[0])){
const z=audit(h,x.past_fields,r);if(z.tips.length)positive++;if(z.poor)poor++;if(!z.complete)missing++;
row(table,[h[0]+' '+h[1],z.prior,z.movement,z.clazz,z.sd.top3+'/'+z.sd.total,z.track.top3+'/'+z.track.total,z.grounds,z.tips.join('／')||'好走材料の観測なし',z.complete?'直近10走の形式照合':'HOLD：全キャリア確認待ち']);
}
const wrap=mk('div');wrap.className='scroll';wrap.append(table);out.append(wrap);
st.textContent=r.date+' '+r.venue+r.race_no+'R '+r.horse_count+'頭：条件変更・好走材料の観測'+positive+'頭／近5走で6着以下が半数以上'+poor+'頭／全キャリア要確認'+missing+'頭。探索的記述であり、勝率上昇や期待値を証明しません。正式クラス判定、最新の馬場・調教・市場を照合するまで買い目HOLD。';
}catch(e){st.textContent='HOLD：'+e.message}
});
})();