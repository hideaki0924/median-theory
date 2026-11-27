/* V117: 市場3450R_本線飛び司令塔_V0.10.xlsx, 司令塔V0.10 / 定義と監査.
 Independent overlapping gates; historical frequencies, not calibrated forecasts. */
(()=>{'use strict';
const stats=Object.freeze({'SAFE-SS':[268,61.2,28.7,10.1],'SAFE-S':[577,51.6,34.1,14.2],'FLY-A':[1101,20.5,28.2,51.2],'FLY-S':[818,20.3,28.6,51.1],'FLY-SS':[481,20.2,24.7,55.1],'FLY-SS2':[519,19.7,24.1,56.3]});
const pair=(a,b)=>[a,b].sort((x,y)=>x-y).join('-');
const le=(a,b)=>a<=b+1e-12,ge=(a,b)=>a+1e-12>=b;
function evaluate(s,m,r){
 if(!s||!Array.isArray(s.a)||s.a.length<2||s.a.length!==r.horse_count)return {status:'HOLD：全頭単複未照合',gates:[]};
 const sorted=s.a.slice().sort((a,b)=>a.win-b.win||a.no-b.no),fav=sorted[0],second=sorted[1];
 if(sorted.some(x=>!Number.isFinite(x.win)||x.win<1)||fav.win===second.win)return {status:'HOLD：単勝1人気一意でない／不正',gates:[]};
 const ratio=second.win/fav.win;
 let tate=null,tatePair=null,tateStatus='馬連全組合せ・同時刻未確認';
 const pairs=m?.maps?.get('馬連'),times=m?.times?.get('馬連');
 if(pairs&&times?.size===1&&!m.invalid?.has('馬連')&&pairs.size===r.horse_count*(r.horse_count-1)/2&&[...times][0]===s.time&&r.horse_count>=3){
  const opponents=sorted.slice(1).map(x=>({no:x.no,odds:pairs.get(pair(fav.no,x.no))})).sort((a,b)=>a.odds-b.odds||a.no-b.no);
  const [a,b,c]=opponents;
  if(opponents.every(x=>Number.isFinite(x.odds)&&x.odds>=1)&&a.odds<b.odds&&(!c||b.odds<c.odds)){
   const other=pairs.get(pair(a.no,b.no));
   if(Number.isFinite(other)&&other>=1){tate=other/a.odds;tatePair=[a.no,b.no];tateStatus='同時刻馬連から計算';}
  }else tateStatus='馬連上位相手同率／欠損：HOLD';
 }
 const conditions=[['SAFE-SS',fav.win<=1.5],['SAFE-S',fav.win>=2?false:tate===null?null:ge(tate,4)],['FLY-A',fav.win>=3],['FLY-S',fav.win<3?false:tate===null?null:le(tate,2)],['FLY-SS',fav.win<3.5?false:tate===null?null:le(tate,2)],['FLY-SS2',fav.win>=3.5&&le(ratio,1.4)]];
 return {status:'過去3,450Rの独立ゲート照合（実戦判断HOLD）',favorite:fav.no,odds:fav.win,ratio,tate,tatePair,tateStatus,gates:conditions.map(([name,match])=>({name,match,stats:stats[name]}))};
}
window.v117Favorite=Object.freeze({evaluate});
})();