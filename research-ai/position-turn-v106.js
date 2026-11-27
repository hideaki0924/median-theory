/* V106: pre-race corner movement and distance change; observational only. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v106Status'),out=$('v106Results');if(!status||!out)return;
let snapshot=null;
const key=r=>[r?.date,r?.venue,String(r?.race_no)].join('|'),selected=()=>[$('v90Date')?.value,$('v90Venue')?.value,String($('v90Race')?.value)].join('|');
const n=x=>{if(x===null||x===undefined||String(x).trim()==='')return null;const v=Number(x);return Number.isFinite(v)?v:null};
const elem=(tag,value='')=>{const e=document.createElement(tag);e.textContent=String(value);return e;};
function put(t,values,header=false){const tr=elem('tr');for(const v of values)tr.append(elem(header?'th':'td',v));t.append(tr)}
window.addEventListener('v86-upcoming-import',e=>{const x=e.detail;if(x?.schema==='TARGET_V86_UPCOMING_RACE_V1'&&x.race&&key(x.race)===selected()){snapshot=x;out.replaceChildren();status.textContent='同一レースの過去走を受信しました。';}});
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',()=>{snapshot=null;out.replaceChildren();status.textContent='HOLD：レース変更のため前回分析を消去。';});
function records(h,fields,date){
if(!Array.isArray(h[8])||h[8].length>10)throw Error(h[1]+'：過去走数が不正');
const rows=h[8].map(values=>{if(!Array.isArray(values)||values.length!==fields.length)throw Error(h[1]+'：走歴列数が不正');const r=Object.fromEntries(fields.map((name,i)=>[name,values[i]]));if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))||r.date>=date||r.source_status!=='STRICT_ID_MATCH')throw Error(h[1]+'：過去走日付またはID照合が不正');return r;}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
if(new Set(rows.map(r=>r.race_id)).size!==rows.length)throw Error(h[1]+'：レースID重複');
return rows;
}
function corner(r){
const size=n(r.field_size),places=[r.corner_1,r.corner_2,r.corner_3,r.corner_4].map(n),finish=n(r.finish_position);
if(size===null||size<2||!Number.isInteger(size))return {valid:false};
const valid=places.map(x=>x!==null&&Number.isInteger(x)&&x>=1&&x<=size);
const earlyAt=valid.findIndex(v=>v);
const early=earlyAt<0?null:places[earlyAt],last=valid[3]?places[3]:null;
const c1=valid[0]?places[0]:null;
const move=early!==null&&last!==null?(early-last)/size:null;
const firstFourth=c1!==null&&last!==null?(c1-last)/size:null;
const finShift=last!==null&&finish!==null&&finish>=1&&finish<=size?(last-finish)/size:null;
return {valid:true,size,early,earlyAt,move,firstFourth,last,finShift,front:early!==null&&early/size<=1/3,deep:early!==null&&early/size>2/3,finish};
}
function evaluate(h,fields,r){
const rs=records(h,fields,r.date),p=rs.map(x=>corner(x));
const prev=rs[0],pd=n(prev?.distance_m),cur=n(r.distance_m);
const change=pd===null||cur===null?'前走距離不明':cur<pd?'距離短縮 '+(pd-cur)+'m':cur>pd?'距離延長 '+(cur-pd)+'m':'同距離';
const earlyFade=p.filter(x=>x.front&&x.finShift!==null&&x.finShift<=-.2).length;
const deepGain=p.filter(x=>x.deep&&x.move!==null&&x.move>=.2).length;
const firstFourth=p.filter(x=>x.firstFourth!==null),advance=firstFourth.filter(x=>x.firstFourth>=.2).length,retreat=firstFourth.filter(x=>x.firstFourth<=-.2).length;
const validFinish=p.filter(x=>x.finShift!==null).length;
const raw=prev?[prev.date,(pd===null?'距離不明':pd+'m'),String(prev.finish_position||'―')+'着',(p[0].earlyAt<0?'通過順欠損':(p[0].earlyAt+1)+'角'+p[0].early),'4角'+(p[0].last??'―')].join(' '):'前走なし';
const exact=rs.filter(x=>x.surface===r.surface&&n(x.distance_m)===cur),top3=exact.filter(x=>{const z=n(x.finish_position);return z!==null&&z>=1&&z<=3}).length;
const note=[];if(change.startsWith('距離短縮')&&p[0]?.front&&p[0]?.finShift!==null&&p[0].finShift<=-.2)note.push('前走前方→ゴール後退・今回距離短縮');
if(earlyFade)note.push('先行後退'+earlyFade+'走');if(deepGain)note.push('後方から4角まで進出'+deepGain+'走');if(top3)note.push('今回同芝ダ同距離3着内'+top3+'走');
return {rs,raw,change,earlyFade,deepGain,advance,retreat,firstFourth:firstFourth.length,validFinish,exact:exact.length,top3,note,complete:rs.length===10||h[9]?.completeness_confirmed===true};
}
window.v106Facts=Object.freeze({evaluate(h,fields,race){const cols=['date','distance_m','finish_position','corner_1','corner_2','corner_3','corner_4','field_size','surface','source_status','race_id'];if(cols.some(c=>!fields.includes(c)))throw Error('TARGET過去走の通過順列が不足');return evaluate(h,fields,race);}});
$('v106Run').addEventListener('click',()=>{
out.replaceChildren();try{
const x=snapshot,r=x?.race;if(!r||key(r)!==selected())throw Error('同一レースのTARGET過去走をV90から転送してください');
if(r.horses.length!==r.horse_count)throw Error('全頭数不一致');
const columns=['date','distance_m','finish_position','corner_1','corner_2','corner_3','corner_4','field_size','surface','source_status','race_id'];
if(columns.some(c=>!x.past_fields?.includes(c)))throw Error('TARGET過去走の通過順列が不足');
const table=elem('table');put(table,['馬番・馬名','前走の位置','距離変更','前方→ゴール後退','後方→4角まで進出','1角→4角進出/後退','今回同距離3着内','観測した見直し材料','キャリア'],true);
let noted=0,missing=0,cornerMissing=0;
for(const h of [...r.horses].sort((a,b)=>a[0]-b[0])){const a=evaluate(h,x.past_fields,r);if(a.note.length)noted++;if(!a.complete)missing++;if(a.firstFourth<a.rs.length)cornerMissing++;
put(table,[h[0]+' '+h[1],a.raw,a.change,a.earlyFade+'/'+a.validFinish,a.deepGain+'/'+a.rs.length,a.advance+'/'+a.retreat+'（比較'+a.firstFourth+'走）',a.top3+'/'+a.exact,a.note.join('／')||'該当する観測なし',a.complete?'10走の形式照合':'HOLD：全キャリア未確認']);}
const div=elem('div');div.className='scroll';div.append(table);out.append(div);
status.textContent=r.date+' '+r.venue+r.race_no+'R 全'+r.horse_count+'頭を監査。見直し材料を観測'+noted+'頭／全キャリア追加確認'+missing+'頭／1角・4角通過順不足を含む'+cornerMissing+'頭。位置変化は記述統計で、ラップ/正式疲労/先行圧の代替ではありません。意図的な距離教育の証明でもなく、買い目HOLD。';
}catch(e){status.textContent='HOLD：'+e.message;}
});
})();