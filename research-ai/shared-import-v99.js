/* V99: shared local file selection; no network, no persistence. */
(()=>{'use strict';
const $=id=>document.getElementById(id),stat=$('v99Status'),summary=$('v99Summary'),run=$('v99Run');
if(!stat||!summary||!run)return;
const wiring=[
 {name:'出馬表',input:'v99Entries',targets:['v90Entries']},
 {name:'TARGET過去成績',input:'v99History',targets:['v90History','v87History','v89History']},
 {name:'ウッド調教',input:'v99Wood',targets:['v91Wood']},
 {name:'坂路調教',input:'v99Hill',targets:['v91Hill']},
 {name:'正式黄金SOURCE',input:'v99Gold',targets:['v92Official']},
 {name:'双子比較SOURCE',input:'v99Twin',targets:['v92Twin']},
 {name:'単勝・複勝上限',input:'v99Single',targets:['v96Single']},
 {name:'単勝オッズ',input:'v99Win',targets:['v95Odds']},
 {name:'7券種オッズ',input:'v99Multi',targets:['v96Multi']}
];
let running=false,listener=null;
const names=()=>wiring.map(w=>[w.name,$(w.input)?.files?.[0]?.name||'未選択']);
function refresh(){summary.replaceChildren();const t=document.createElement('table');
for(const [title,name] of names()){const r=document.createElement('tr');for(const v of [title,name]){const td=document.createElement('td');td.textContent=v;r.append(td)}t.append(r)}summary.append(t)}
function assign(target,file){if(!target||!file)throw Error('必須ファイル入力先が存在しません');
const dt=new DataTransfer();dt.items.add(file);target.files=dt.files;}
function distribute(){
for(const w of wiring){const file=$(w.input)?.files?.[0];if(!file)continue;
for(const target of w.targets){const element=$(target);if(!element)throw Error('既存入力欄 '+target+' が見つかりません');assign(element,file);}}
}
function update(message){stat.textContent=message;refresh()}
for(const w of wiring){$(w.input)?.addEventListener('change',()=>{
 try{distribute();update('端末内ファイルの割当てを更新しました。ファイル内容はGitHubに送信していません。')}catch(e){update('HOLD：'+e.message)}
});}
function trigger(id){const b=$(id);if(b&&!b.disabled)b.click();}
function finish(){if(listener){window.removeEventListener('v86-upcoming-import',listener);listener=null}running=false;run.disabled=false;}
run.addEventListener('click',()=>{
if(running)return;running=true;run.disabled=true;
try{
distribute();
if(!$('v99History')?.files?.[0]&&!$('v90History')?.files?.[0])throw Error('TARGET成績CSVを選択してください');
const race={date:$('v90Date').value,venue:$('v90Venue').value,no:$('v90Race').value};
if(!/^\d{4}-\d{2}-\d{2}$/.test(race.date)||!race.venue||!race.no)throw Error('V90で開催日・競馬場・レースを選択してください');
if(listener)window.removeEventListener('v86-upcoming-import',listener);
listener=e=>{
const data=e.detail?.race;if(!data||data.date!==race.date||data.venue!==race.venue||String(data.race_no)!==race.no)return;
finish();
for(const id of ['v91Run','v92Run','v93Run','v94Run','v95Run','v96Run','v98Check','v102Run','v103Run','v104Run','v105Run'])trigger(id);
update('全頭10走データを受信。V91～V98の研究監査を起動しました。各カードのHOLDと不足SOURCEを確認してください。買い目HOLD。');
};
window.addEventListener('v86-upcoming-import',listener);
update('出馬表・TARGET照合を開始。レースの正式ID照合が完了した場合のみ一括監査を起動します。');
trigger('v90Load');
setTimeout(()=>{
 if(!running)return;
 const a=$('v88Status')?.textContent||'',b=$('v90Status')?.textContent||'',c=$('v89Status')?.textContent||'';
 finish();
 update('HOLD：30秒以内に同一レースの監査台帳を受信できませんでした。V90／V88の状態を確認してください。'+[a,b,c].filter(Boolean).join('｜').slice(0,500));
},30000);
}catch(e){finish();update('HOLD：'+e.message)}
});
refresh();
})();