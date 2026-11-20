/* V103 | Per-horse verified past-10 detailed inspection; local-only, descriptive evidence. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v103Status'),root=$('v103Results');
if(!status||!root)return;
let snapshot=null;
const expectedFields=['date','distance_m','finish_position','corner_1','corner_2','corner_3','corner_4','race_id','racecourse','class_name','going','margin_sec','finish_time_seconds','last3f_seconds','surface','weight_kg','jockey','trainer','body_weight_kg','past_win_odds','field_size','source_status','data_quality_flags'];
const selected=()=>[$('v90Date')?.value,$('v90Venue')?.value,String($('v90Race')?.value)].join('|');
const raceKey=r=>[r.date,r.venue,String(r.race_no)].join('|');
const asText=x=>x===null||x===undefined||String(x).trim()===''?'―':String(x).trim();
const numeric=x=>{if(x===null||x===undefined||String(x).trim()==='')return null;const n=Number(x);return Number.isFinite(n)?n:null};
const put=(e,text)=>{e.textContent=text;return e};
const elem=(tag,text)=>put(document.createElement(tag),text??'');
const td=(tr,text,head=false)=>{const e=elem(head?'th':'td',String(text));tr.append(e)};
const tag=(arr)=>arr.length?arr.join('／'):'該当材料なし';
function reset(text){snapshot=null;root.replaceChildren();status.textContent=text;}
window.addEventListener('v86-upcoming-import',e=>{
const x=e.detail;if(x?.schema!=='TARGET_V86_UPCOMING_RACE_V1'||!x.race||raceKey(x.race)!==selected())return;
snapshot=x;root.replaceChildren();status.textContent='同一レースの履歴を受信。全頭10走の個票を作成できます。';
});
for(const id of ['v90Date','v90Venue','v90Race'])$(id)?.addEventListener('change',()=>reset('HOLD：レース選択変更。過去走個票をクリアしました。'));
function parse(h,fields,cutoff){
if(!Array.isArray(h[8]))throw Error(h[1]+'：過去走配列がありません');
if(h[8].length>10)throw Error(h[1]+'：過去走が10走を超過');
const records=h[8].map((values,i)=>{
if(!Array.isArray(values)||values.length!==fields.length)throw Error(h[1]+'：過去走列数が不正（'+(i+1)+'走）');
const r=Object.fromEntries(fields.map((k,j)=>[k,values[j]]));
if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))||r.date>=cutoff||r.source_status!=='STRICT_ID_MATCH')throw Error(h[1]+'：日付・正式IDの不整合（'+(i+1)+'走）');
return r;
}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.race_id).localeCompare(String(a.race_id)));
if(new Set(records.map(r=>r.race_id)).size!==records.length)throw Error(h[1]+'：同じレースIDが重複');
return records;
}
function analyze(records,race){
const good=x=>{const p=numeric(x.finish_position);return p!==null&&p>=1&&p<=3;};
const rows=records.filter(r=>{const p=numeric(r.finish_position);return p!==null&&p>=1&&p<=28;});
const recent5=records.slice(0,5),top5=recent5.filter(good).length;
const sameDist=rows.filter(x=>numeric(x.distance_m)===numeric(race.distance_m)&&x.surface===race.surface);
const sameCourse=rows.filter(x=>x.racecourse===race.venue&&numeric(x.distance_m)===numeric(race.distance_m)&&x.surface===race.surface);
const goodSame=sameDist.filter(good),goodSameCourse=sameCourse.filter(good);
const clearMargin=goodSame.filter(x=>numeric(x.margin_sec)!==null).map(x=>numeric(x.margin_sec));
const pos=rows.filter(x=>{const n=numeric(x.field_size),c1=numeric(x.corner_1),c4=numeric(x.corner_4);return n!==null&&n>=2&&c1!==null&&c4!==null&&c1>=1&&c4>=1&&c1<=n&&c4<=n});
const moved=pos.filter(x=>(numeric(x.corner_1)-numeric(x.corner_4))/numeric(x.field_size)>=.2);
const faded=pos.filter(x=>(numeric(x.corner_4)-numeric(x.corner_1))/numeric(x.field_size)>=.2);
const wins=records.filter(x=>numeric(x.finish_position)===1).length;
const outsider=rows.filter(x=>{const w=numeric(x.past_win_odds);return w!==null&&w>=10&&good(x)});
const observations=[];
if(top5>=2)observations.push('直近5走で3着内'+top5+'回（探索的）');
if(goodSame.length)observations.push('今回と同じ芝ダ・距離で3着内'+goodSame.length+'回');
if(goodSameCourse.length)observations.push('今回と同じ競馬場・距離で3着内'+goodSameCourse.length+'回');
if(moved.length)observations.push('1角→4角で20pt以上進出'+moved.length+'回');
if(faded.length)observations.push('1角→4角で20pt以上後退'+faded.length+'回');
if(outsider.length)observations.push('過去に単勝10倍以上で3着内'+outsider.length+'回');
return {top5,sameDist:sameDist.length,goodSame:goodSame.length,sameCourse:sameCourse.length,goodSameCourse:goodSameCourse.length,clearMargin,wins,moved:moved.length,faded:faded.length,outsider:outsider.length,observations};
}
$('v103Run').addEventListener('click',()=>{
root.replaceChildren();
try{
const x=snapshot;if(!x?.race)throw Error('先にV90から対象レースの全頭過去走を転送してください');
const race=x.race;if(raceKey(race)!==selected())throw Error('レース選択と過去走データが一致しません');
if(race.horse_count!==race.horses.length)throw Error('出走頭数が一致しません');
if(!Array.isArray(x.past_fields)||expectedFields.some(f=>!x.past_fields.includes(f)))throw Error('TARGET過去走の必要列が不足');
const all=new Set(),nos=new Set(),fragment=document.createDocumentFragment();
let zero=0,short=0,ten=0,holds=0,total=0;
for(const horse of [...race.horses].sort((a,b)=>a[0]-b[0])){
if(all.has(horse[2])||nos.has(horse[0]))throw Error('馬番・血統登録番号が重複');all.add(horse[2]);nos.add(horse[0]);
const past=parse(horse,x.past_fields,race.date),stats=analyze(past,race);
if(past.length===0)zero++;else if(past.length<10)short++;else ten++;
total+=past.length;
const career=horse[9]||{};
const confirmed=String(horse[3])==='10走正式ID照合完了_能力等未監査';
const evidenceClass=confirmed?'直近10走の形式照合あり・能力未監査':career.debut_row_observed?'最古に新馬戦を観測・全キャリア未確定':'全キャリア・履歴の不足確認要';
if(!confirmed)holds++;
const details=elem('details');details.className='v103Horse';
const summary=elem('summary',horse[0]+'番 '+horse[1]+'｜過去'+past.length+'走｜近5走3着内'+stats.top5+'回｜'+(confirmed?'10走確認':'HOLD'));
details.append(summary);
details.append(elem('p','過去走SOURCE：正式ID照合済の台帳／'+evidenceClass+'。過去走の数値はクラス・馬場・距離による時計補正を行っていません。'));
const facts=elem('p','【好走根拠を探す】'+tag(stats.observations));details.append(facts);
const mt=elem('p','同芝ダ・同距離 '+stats.goodSame+'/'+stats.sameDist+'、同競馬場・同距離 '+stats.goodSameCourse+'/'+stats.sameCourse+'、過去勝利 '+stats.wins+'、過去穴好走 '+stats.outsider+'。');
details.append(mt);
const scroll=elem('div');scroll.className='scroll';const table=elem('table');
const cols=['走','年月日','競馬場','芝ダ','距離','クラス','馬場','着順','着差秒','走破秒','上り3F秒','1角','2角','3角','4角','頭数','斤量','騎手','厩舎','馬体重','当時単勝','SOURCE状態'];
const hd=elem('tr');cols.forEach(c=>td(hd,c,true));table.append(hd);
for(let i=0;i<past.length;i++){
const p=past[i],tr=elem('tr');
const values=[i+1,p.date,p.racecourse,p.surface,p.distance_m,p.class_name,p.going,p.finish_position,p.margin_sec,p.finish_time_seconds,p.last3f_seconds,p.corner_1,p.corner_2,p.corner_3,p.corner_4,p.field_size,p.weight_kg,p.jockey,p.trainer,p.body_weight_kg,p.past_win_odds,p.data_quality_flags?'特殊結果/要監査':'正式ID照合'];
values.forEach(v=>td(tr,asText(v)));table.append(tr);
}
if(!past.length)details.append(elem('p','過去走なし（新馬か履歴未取得かは別途確認）。'));
else{scroll.append(table);details.append(scroll);}
fragment.append(details);
}
root.append(fragment);
status.textContent=race.date+' '+race.venue+race.race_no+'R '+race.horse_count+'頭／過去走'+total+'件の個票生成。10走'+ten+'頭、10走未満'+short+'頭、0走'+zero+'頭、正式確認HOLD'+holds+'頭。全頭を表示。時計の補正・正式クラス比較・調教との相関・発走前市場の過小評価判定は未完成。買い目HOLD。';
}catch(err){status.textContent='HOLD：'+err.message}
});
})();