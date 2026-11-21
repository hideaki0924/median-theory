/* Practical race launcher: paste number/name + one private TARGET file, then use existing V88/V87 and V91-V107. */
(()=>{'use strict';
const $=id=>document.getElementById(id),button=$('quickRun'),state=$('quickStatus');if(!button||!state)return;
const norm=s=>String(s??'').normalize('NFKC').replace(/\s/g,'').trim();
function set(id,value){const e=$(id);if(!e)throw Error('旧画面の入力欄が見つかりません：'+id);e.value=value;}
function fileTo(id,file){if(!file)return;const e=$(id);if(!e)throw Error('TARGET入力欄が見つかりません');const d=new DataTransfer();d.items.add(file);e.files=d.files;}
function importLines(text){
const rows=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const seenN=new Set(),seenName=new Set(),out=[];
for(const raw of rows){const parts=raw.includes('\t')?raw.split('\t'):raw.split(',');
if(parts.length!==2)throw Error('馬番,馬名の2列が必要：'+raw);
const number=parts[0].trim(),name=parts[1].trim();
if(/^(馬番|horse_number)$/i.test(number)&&/^(馬名|horse_name)$/i.test(name))continue;
const no=Number(number);if(!/^\d+$/.test(number)||!Number.isInteger(no)||no<1||no>28||!name||seenN.has(no)||seenName.has(norm(name)))throw Error('馬番・馬名が不正または重複：'+raw);
seenN.add(no);seenName.add(norm(name));out.push([no,name]);}
if(out.length<2||out.length>28)throw Error('出走馬を2～28頭、全頭分入力してください');
out.sort((a,b)=>a[0]-b[0]);return out.map(x=>x.join(',')).join('\n');
}
let pending=null;
function cancel(){if(pending){window.removeEventListener('v86-upcoming-import',pending);pending=null;}button.disabled=false;}
button.addEventListener('click',()=>{
if(button.disabled)return;button.disabled=true;
try{
const date=$('quickDate').value,venue=$('quickVenue').value,race=$('quickRace').value;
const surface=$('quickSurface').value,distance=$('quickDistance').value,klass=$('quickClass').value.trim();
const lineup=importLines($('quickLineup').value);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!venue||!race||!surface||!klass||!Number.isInteger(Number(distance))||+distance<600||+distance>4200)throw Error('開催日・競馬場・R・芝ダ・距離・クラスを入力してください');
const file=$('v99History')?.files?.[0]||$('v90History')?.files?.[0]||$('v87History')?.files?.[0];
if(!file)throw Error('上の「TARGET過去成績」のCSVを選択してください');
set('v90Date',date);set('v90Venue',venue);set('v90Race',race);
for(const id of ['v90Date','v90Venue','v90Race'])$(id).dispatchEvent(new Event('change',{bubbles:true}));
set('v88Date',date);set('v88Venue',venue);set('v88RaceNo',race);set('v88Surface',surface);set('v88Distance',distance);set('v88Class',klass);set('v88Lineup',lineup);
fileTo('v87History',file);fileTo('v90History',file);
const raceKey=[date,venue,race].join('|');
pending=e=>{
const r=e.detail?.race;if(!r||[r.date,r.venue,String(r.race_no)].join('|')!==raceKey)return;
cancel();
for(const id of ['v91Run','v92Run','v93Run','v94Run','v95Run','v96Run','v98Check','v102Run','v103Run','v104Run','v105Run','v106Run','v107Run']){const target=$(id);if(target&&!target.disabled)target.click();}
state.textContent='全頭10走を転送し、研究監査を起動。下の「V107｜全頭横断」や「V103｜全頭10走個票」を確認してください。調教・オッズ未入力はHOLD表示。買い目は未確定。';
$('v107Cross')?.scrollIntoView({behavior:'smooth'});
};
window.addEventListener('v86-upcoming-import',pending);
state.textContent='馬名からTARGET登録番号を照合中…';
$('v88Build').click();
setTimeout(()=>{
if(pending===null)return;
const msg=$('v88Status')?.textContent||'';
if(msg.startsWith('HOLD')||!$('v88Build')?.disabled){
cancel();state.textContent='HOLD：'+(msg||'全頭台帳を受信できませんでした。出馬表・TARGET CSVを確認してください。');
}
},60000);
}catch(e){cancel();state.textContent='HOLD：'+e.message;}
});
$('quickLineup')?.addEventListener('paste',()=>{state.textContent='馬番・馬名を貼り付けました。全頭が含まれているか確認してください。';});
})();