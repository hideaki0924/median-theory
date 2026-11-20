/* V100 race-change safety gate and analysis readiness report. */
(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('v100Status'),results=$('v100Results');
if(!status||!results)return;
const sourceNames=[['V88 正式ID・全頭10走','v88Status'],['V91 ウッド・坂路','v91Status'],['V92 正式黄金・双子','v92Status'],['V93 能力×調教','v93Status'],['V94 位置取り・連戦','v94Status'],['V95 能力・市場一覧','v95Status'],['V96 メジアン・7券種','v96Status'],['V98 CSV診断','v98Status'],['V102 10走未満・新馬起点','v102Status']];
let observedKey=null, importedKey=null;
const key=()=>[$('v90Date')?.value,$('v90Venue')?.value,$('v90Race')?.value].join('|');
const active=()=>key()===$('v88Date')?.value+'|'+$('v88Venue')?.value+'|'+$('v88RaceNo')?.value;
function clear(reason){
 const stale=['v91Results','v92Results','v93Results','v94Results','v95Results','v96Results','v98Results','v102Results'];
 stale.forEach(id=>$(id)?.replaceChildren());
 for(const id of ['v91Status','v92Status','v93Status','v94Status','v95Status','v96Status','v98Status','v102Status']){
  if($(id))$(id).textContent='未実行：レース選択変更。新しいレースのデータを転送してください。';
 }
 results.replaceChildren();importedKey=null;
 status.textContent='HOLD：'+reason+'。以前のレースの監査結果をクリアしました。';
}
for(const id of ['v90Date','v90Venue','v90Race']){
 $(id)?.addEventListener('change',()=>{
  const k=key();if(k!==observedKey){observedKey=k;clear('対象レースを変更');}
 });
}
observedKey=key();
window.addEventListener('v86-upcoming-import',event=>{
 const r=event.detail?.race;if(!r)return;
 if([r.date,r.venue,String(r.race_no)].join('|')===key()){
  importedKey=key();
  status.textContent='新しいレースの全頭10走台帳を受信。各研究カードの監査を実行し、最後に本画面で不足項目を確認してください。';
 }
});
function row(t,arr){const r=document.createElement('tr');for(const v of arr){const x=document.createElement(t?'th':'td');x.textContent=String(v);r.append(x)}return r}
$('v100Check')?.addEventListener('click',()=>{
 results.replaceChildren();const tbl=document.createElement('table');
 tbl.append(row(true,['研究ゲート','状態','根拠（画面表示）']));
 let holds=0,checked=0;
 const correct=active()&&importedKey===key();
 if(!correct){holds++;tbl.append(row(false,['レース一致','HOLD','V90選択とV88出馬表／受信した全頭10走台帳が未一致。再転送してください。']));}
 else{checked++;tbl.append(row(false,['レース一致','台帳受信済','選択レースと入力された出馬表の同一性を確認。出走馬名の公式照合は別途必要。']));}
 for(const [name,id] of sourceNames){
 const text=String($(id)?.textContent||'').trim();
 const isMissing=!text||text.includes('未実行')||text.includes('未検証');
 const isHold=isMissing||text.startsWith('HOLD')||text.includes('HOLD：')||text.includes('買い目HOLD');
 if(isHold)holds++;else checked++;
 tbl.append(row(false,[name,isHold?'要監査':'表示あり',text.slice(0,165)||'未実行']));
 }
 const wrap=document.createElement('div');wrap.className='scroll';wrap.append(tbl);results.append(wrap);
 status.textContent='V100監査：対象'+key()+'／'+checked+'項目は形式上の状態表示あり、'+holds+'項目は不足・HOLD。これは各研究の完了を証明するものではありません。公式の全頭10走・馬体重・直前調教・最新オッズ・能力勝率・期待値を再監査するまで馬券HOLD。';
});
})();