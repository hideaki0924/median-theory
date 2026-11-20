/* V102: diagnostic evidence for <10 starts; no certification from one debut record. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v102Status'),out=$('v102Results');if(!status||!out)return;
let snapshot=null;
const current=()=>[$('v90Date')?.value,$('v90Venue')?.value,String($('v90Race')?.value)].join('|');
window.addEventListener('v86-upcoming-import',e=>{
const d=e.detail;if(d?.schema!=='TARGET_V86_UPCOMING_RACE_V1'||!d.race)return;
if([d.race.date,d.race.venue,String(d.race.race_no)].join('|')!==current())return;
snapshot=d;status.textContent='同一レースの走歴を受信。過去10走未満の新馬起点・全キャリア不足を監査できます。';
});
for(const field of ['v90Date','v90Venue','v90Race'])$(field)?.addEventListener('change',()=>{snapshot=null;out.replaceChildren();status.textContent='HOLD：レース変更。全キャリア診断をクリアしました。';});
function appendRow(t,entries,th=false){const row=document.createElement('tr');for(const s of entries){const td=document.createElement(th?'th':'td');td.textContent=String(s);row.append(td)}t.append(row)}
$('v102Run').addEventListener('click',()=>{
out.replaceChildren();
try{
const d=snapshot,r=d?.race;if(!r)throw Error('同一レースのV87/V88台帳が未転送です');
if([r.date,r.venue,String(r.race_no)].join('|')!==current())throw Error('レースが一致しません');
if(r.horse_count!==r.horses.length)throw Error('全頭数不一致');
const table=document.createElement('table');appendRow(table,['馬番・馬名','過去走数','最古の出走日','最古のクラス','新馬起点実測','異常履歴','暫定状態'],true);
let short=0,debut=0,unknown=0,anomaly=0,ten=0;
for(const h of [...r.horses].sort((a,b)=>a[0]-b[0])){
const e=h[9]||{},runs=Array.isArray(h[8])?h[8].length:0;if(runs<10)short++;else ten++;
if(e.debut_row_observed)debut++;
if(e.invalid_linked_history)anomaly++;
const state=String(h[3]);if(state.startsWith('HOLD'))unknown++;
const msg=state==='10走正式ID照合完了_能力等未監査'?'直近10走の形式照合済（能力等未監査）':
e.debut_row_observed&&!e.invalid_linked_history?'新馬まで観測・キャリア完全性は未確定':
e.invalid_linked_history?'異常履歴あり・HOLD':'最古までの収録が不明・HOLD';
appendRow(table,[h[0]+' '+h[1],runs,' '+(e.oldest_date||'不明'),e.oldest_race_class||'不明',e.debut_row_observed?'あり':'未確認',e.invalid_linked_history?'あり':'検出なし',msg]);
}
const wrap=document.createElement('div');wrap.className='scroll';wrap.append(table);out.append(wrap);
status.textContent=r.date+' '+r.venue+r.race_no+'R '+r.horse_count+'頭。10走以上'+ten+'頭／10走未満'+short+'頭／新馬起点を観測'+debut+'頭／異常履歴'+anomaly+'頭／HOLD'+unknown+'頭。新馬戦が記録されていても、TARGETファイルの更新漏れ・地方や海外での出走歴を否定できません。全キャリアの正式確認が済むまで馬券HOLD。';
}catch(e){status.textContent='HOLD：'+e.message}
});
})();