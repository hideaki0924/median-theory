/* V91: local-only training CSV audit. No fetch/storage/uploads. */
(()=>{'use strict';
const $=id=>document.getElementById(id), norm=s=>String(s??'').normalize('NFKC').replace(/[\s　]+/g,'').trim();
const status=$('v91Status');if(!status)return;
const alias={horse:['馬名','horse_name','horse','name'],date:['日付','調教日','年月日','date','workout_date','実施日'],last:['1F','終い1F','ラスト1F','L1','last1f','終い','4F','4ハロン'],four:['4F','4ハロン','4f','total4f'],three:['3F','3ハロン','3f'],two:['2F','2ハロン','2f'],one:['1F','終い1F','ラスト1F','l1','last1f'],course:['コース','場所','調教場所','course']};
const ci=(headers,keys)=>{for(const k of keys){const p=headers.findIndex(x=>norm(x).toLowerCase()===norm(k).toLowerCase());if(p>=0)return p;}return -1;};
function iso(v){const t=String(v??'').trim();let m=t.match(/^(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);if(m)return [m[1],m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-');m=t.match(/^(\d{4})(\d{2})(\d{2})$/);return m?m[1]+'-'+m[2]+'-'+m[3]:'';}
function num(x){let s=String(x??'').trim().replace(/秒/g,'').replace(/,/g,'.');return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null;}
function format(x){return x==null?'―':x.toFixed(1);}
function horseList(){const text=$('v88Lineup')?.value||'';let a=text.split(/\r?\n/).map(l=>l.split(/[\t,]/)).filter(c=>c.length===2&&/^\d+$/.test(c[0].trim())&&c[1].trim()).map(c=>({no:Number(c[0]),name:c[1].trim()}));return a.sort((x,y)=>x.no-y.no);}
async function decode(file){const bridge=window.v87Bridge;if(!bridge?.decodeCSV)throw Error('V87 CSV読取エンジンが必要です');return bridge.decodeCSV(file);}
async function parse(file,type,cutoff){
if(!file)return {rows:[],issues:[],columns:[]};
const rows=await decode(file);if(!rows?.length)throw Error(type+' CSVを読み取れません');
const header=rows[0].map(x=>String(x??'').replace(/^\uFEFF/,'').trim());
const h=ci(header,alias.horse),d=ci(header,alias.date);
if(h<0||d<0)throw Error(type+' CSVに馬名・調教日列が見つかりません。列名：'+header.slice(0,12).join('／'));
const indexes={four:ci(header,alias.four),three:ci(header,alias.three),two:ci(header,alias.two),one:ci(header,alias.one),course:ci(header,alias.course)};
const result=[],issues=[];let future=0,undated=0;
for(const r of rows.slice(1)){const name=norm(r[h]);if(!name)continue;const date=iso(r[d]);if(!date){undated++;continue;}if(date>=cutoff){future++;continue;}const o={name,date,type,course:indexes.course<0?type:String(r[indexes.course]||type)};
for(const k of ['four','three','two','one'])o[k]=indexes[k]<0?null:num(r[indexes[k]]);
if(['four','three','two','one'].every(k=>o[k]===null))continue;result.push(o);}
if(future)issues.push('発走日以降の行を除外 '+future+'件');if(undated)issues.push('日付不明を除外 '+undated+'件');
return {rows:result,issues,columns:header};
}
function td(tr,value){const c=document.createElement('td');c.textContent=value;tr.append(c);}
$('v91Run').addEventListener('click',async()=>{
const b=$('v91Run');b.disabled=true;status.textContent='調教CSVを読み取り中…';$('v91Results').replaceChildren();
try{
const cutoff=$('v90Date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))throw Error('先に開催日を選択してください');
if($('v88Date')?.value!==$('v90Date')?.value||$('v88Venue')?.value!==$('v90Venue')?.value||Number($('v88RaceNo')?.value)!==Number($('v90Race')?.value))throw Error('出馬表のレースが現在のV90選択と一致しません。対象レースを再転送してください');
const horses=horseList();if(horses.length<2)throw Error('先に出馬表をV90から全頭10走へ転送してください（馬名照合が必要です）');
const wood=$('v91Wood').files[0],hill=$('v91Hill').files[0];if(!wood&&!hill)throw Error('ウッド・坂路のいずれかのCSVを選択してください');
const [w,h]=await Promise.all([parse(wood,'ウッド',cutoff),parse(hill,'坂路',cutoff)]);
const map=new Map();for(const a of [...w.rows,...h.rows]){if(!map.has(a.name))map.set(a.name,[]);map.get(a.name).push(a);}
const table=document.createElement('table'),head=document.createElement('tr');for(const label of ['馬番','馬名','直近調教日','種別','4F','3F','2F','1F','前回比（1F）','監査']){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);
let hit=0;for(const horse of horses){const a=(map.get(norm(horse.name))||[]).sort((x,y)=>y.date.localeCompare(x.date));const tr=document.createElement('tr');td(tr,String(horse.no));td(tr,horse.name);
if(!a.length){for(const v of ['―','―','―','―','―','―','―','HOLD：一致調教なし'])td(tr,v);}
else{hit++;const x=a[0],previous=a.find(z=>z.date<x.date&&z.type===x.type&&z.one!=null);const diff=x.one!=null&&previous?x.one-previous.one:null;for(const v of [x.date,x.type,format(x.four),format(x.three),format(x.two),format(x.one),diff==null?'比較不可':(diff>0?'+':'')+diff.toFixed(1)+'秒','照合済（能力評価は未確定）'])td(tr,v);}
table.append(tr);}
const wrap=document.createElement('div');wrap.className='scroll';wrap.append(table);$('v91Results').append(wrap);
status.textContent='調教を馬名照合 '+hit+'/'+horses.length+'頭。ウッド '+w.rows.length+'件／坂路 '+h.rows.length+'件。'+[...w.issues,...h.issues].join('。')+'。前回比は同種別の直前別日調教との1F秒差（負値＝速い）。双子・黄金の正式判定や当日情報監査は未接続。買い目HOLD。';
}catch(e){status.textContent='HOLD：'+e.message;}finally{b.disabled=false;}
});
})();