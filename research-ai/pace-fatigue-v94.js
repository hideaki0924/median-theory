/* V94: descriptive pace/position/fatigue evidence audit. Not a replacement for frozen factor formulas. */
(()=>{'use strict';
const $=id=>document.getElementById(id);const status=$('v94Status'),output=$('v94Results');
if(!status||!output)return;
let active=null;
window.addEventListener('v86-upcoming-import',e=>{const obj=e.detail;if(obj&&obj.schema==='TARGET_V86_UPCOMING_RACE_V1'){active=obj;status.textContent='10走台帳を受信。展開・疲労の観測値を計算できます。';}});
function value(v){if(v===null||v===undefined||String(v).trim()==='')return null;const z=Number(v);return Number.isFinite(z)?z:null;}
function days(a,b){let x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.round((y-x)/86400000):null;}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
function fmt(v,dp=2){return v===null?'データなし':v.toFixed(dp);}
const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
function calculate(h, fields,race){
const index=new Map(fields.map((k,i)=>[k,i]));
const past=(h[8]||[]).map(row=>Object.fromEntries(fields.map((k,i)=>[k,row[i]]))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
if(past.length>10)throw Error(h[1]+'：過去10走を超過');
if(past.some(p=>!p.date||p.date>=race.date||p.source_status!=='STRICT_ID_MATCH'))throw Error(h[1]+'：未来走または未照合履歴');
const valid=past.filter(p=>{const size=value(p.field_size),first=value(p.corner_1),fourth=value(p.corner_4);return size!==null&&size>=2&&first!==null&&fourth!==null&&first>=1&&fourth>=1&&first<=size&&fourth<=size;});
const pos=valid.map(p=>({first:value(p.corner_1)/value(p.field_size),fourth:value(p.corner_4)/value(p.field_size),move:(value(p.corner_1)-value(p.corner_4))/value(p.field_size)}));
const front=pos.filter(p=>p.first<=.33).length;
const advance=pos.filter(p=>p.move>=.20).length;
const retreat=pos.filter(p=>p.move<=-.20).length;
const gaps=[];for(let i=0;i+1<past.length;i++){const diff=days(past[i+1].date,past[i].date);if(diff!==null&&diff>=0)gaps.push(diff);}
const startGap=past.length?days(past[0].date,race.date):null;
if(startGap!==null&&startGap<0)throw Error('未来の出走履歴');
const short=gaps.filter(x=>x<=14).length;
const finish=past.map(p=>value(p.finish_position)).filter(x=>x!==null);
const top3=finish.filter(x=>x>=1&&x<=3).length;
const rawTime=past.map(p=>value(p.finish_time_seconds)).filter(v=>v!==null);
const last3=past.map(p=>value(p.last3f_seconds)).filter(v=>v!==null);
return {past:past.length,valid:valid.length,front,advance,retreat,avgFirst:avg(pos.map(p=>p.first)),avgFourth:avg(pos.map(p=>p.fourth)),avgMove:avg(pos.map(p=>p.move)),gaps,short,startGap,top3,rawTime:rawTime.length,last3:last3.length, career:h[9]?.basis==='JRA_NEWCOMER_DEBUT_AND_ALL_LINKED_RACES'};
}
$('v94Run').addEventListener('click',()=>{
output.replaceChildren();
try{
if(!active)throw Error('V90から対象レースのTARGET過去走を転送してください');
const race=active.race, fields=active.past_fields||[];
if(race.date!==$('v90Date').value||race.venue!==$('v90Venue').value||Number(race.race_no)!==Number($('v90Race').value))throw Error('現在選択しているレースと分析データが違います。再転送してください');
if(race.horse_count!==race.horses.length)throw Error('出走頭数不一致');
const all=race.horses.map(h=>({horse:h,stats:calculate(h,fields,race)})).sort((a,b)=>a.horse[0]-b.horse[0]);
const table=el('table',''),header=el('tr','');
for(const title of ['馬番・馬名','過去走','先行回数','位置上昇/後退','平均4角位置率','レース間隔','短期連戦','観測上の注意'])header.append(el('th',title));table.append(header);
const details=[];
for(const {horse:h,stats:s} of all){
const row=el('tr','');
const ratio=s.valid?s.front+'/'+s.valid:'算出不可';
const move=s.valid?s.advance+'/'+s.retreat+'（'+s.valid+'走中）':'算出不可';
const sample=s.past===0?(s.career?'新馬・未出走':'走歴なし'):s.past<10?'全キャリアの照合要':s.valid<3?'通過順の標本不足':'位置取り参考値のみ';
const vals=[h[0]+' '+h[1],s.past+'走',ratio,move,fmt(s.avgFourth),s.startGap===null?'不明':s.startGap+'日',s.short+'/'+s.gaps.length+'（14日以内）',sample];
vals.forEach(v=>row.append(el('td',String(v))));table.append(row);
details.push({horse_number:h[0],horse_name:h[1],...s});
}
const wrap=el('div','');wrap.className='scroll';wrap.append(table);output.append(wrap);
status.textContent='全'+all.length+'頭の展開・連戦観測値を表示。先行回数＝1角順位/頭数が上位1/3の出現回数。位置上昇/後退＝1角→4角の順位率が20pt以上変化した回数。短期連戦＝過去のレース間隔14日以内の回数。すべて探索的な記述統計で、正式な疲労指数・展開得点の代替ではありません。距離・クラス・馬場の調整、先行圧、当日情報、調教総合判定は未完了。買い目HOLD。';
window.__v94LastAudit={race:{date:race.date,venue:race.venue,race_no:race.race_no},details};
}catch(e){status.textContent='HOLD：'+e.message;}
});
})();