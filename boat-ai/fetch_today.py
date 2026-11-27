import concurrent.futures, datetime, json, pathlib, re, urllib.request, time, sys
from html.parser import HTMLParser
class Parser(HTMLParser):
 def __init__(self):
  super().__init__(); self.boats=[]; self.row=None; self.cell=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='tr': self.row=[]
  if tag=='td' and self.row is not None: self.cell=[a.get('class',''),'']
  if tag=='br' and self.cell is not None: self.cell[1]+=' '
 def handle_data(self,data):
  if self.cell is not None: self.cell[1]+=data+' '
 def handle_endtag(self,tag):
  if tag=='td' and self.cell is not None: self.row.append(self.cell); self.cell=None
  if tag=='tr' and self.row is not None:
   if len(self.row)>=6 and re.search(r'is-boatColor[1-6]',self.row[0][0]): self.boats.append(self.row)
   self.row=None
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
 for attempt in range(2):
  try:
   with urllib.request.urlopen(req,timeout=10) as r: return r.read().decode('utf-8')
  except Exception:
   if attempt: raise
   time.sleep(1)
def race(day,j,r):
 try:
  p=Parser();p.feed(get(f'https://www.boatrace.jp/owpc/pc/race/racelist?hd={day}&jcd={j:02}&rno={r}'))
  if len(p.boats)!=6: return None
  result=[]
  for i,row in enumerate(p.boats,1):
   if f'is-boatColor{i}' not in row[0][0]: return None
   n=[float(x) for x in re.findall(r'\d+\.\d+',row[4][1])]
   l=[float(x) for x in re.findall(r'\d+\.\d+',row[5][1])]
   if len(n)<3 or len(l)<3 or not 0<n[0]<=10 or not 0<=l[0]<=10: return None
   st=re.findall(r'(?<!\d)0\.\d{2}(?!\d)',row[3][1])
   motor=re.findall(r'\d+\.\d+',row[6][1]) if len(row)>6 else []
   avg=float(st[-1]) if st and 0<float(st[-1])<1 else None
   m=float(motor[0]) if motor and 0<=float(motor[0])<=100 else None
   result.append([n[0],l[0],avg,None,None,m])
  return (f'{j:02}-{r}',result)
 except Exception as e:
  print(f'{day} {j:02}-{r}: {type(e).__name__}: {e}',file=sys.stderr)
  return None
def main():
 day=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y%m%d')
 # discover active venues from official daily race index
 html=get(f'https://www.boatrace.jp/owpc/pc/race/index?hd={day}')
 venues=sorted({int(x) for x in re.findall(r'jcd=(\d{2})',html) if 1<=int(x)<=24})
 if not venues: raise RuntimeError('No active venues verified')
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  results=list(pool.map(lambda x:race(day,*x),[(j,r) for j in venues for r in range(1,13)]))
 fresh=dict(x for x in results if x)
 if not fresh: raise RuntimeError('No verified racecards')
 path=pathlib.Path('boat-ai/data/today.json')
 old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
 data=dict(old.get('races',{})) if old.get('date')==day else {}
 data.update(fresh)
 expected={f'{j:02}-{r}' for j in venues for r in range(1,13)}
 missing=sorted(expected-set(data))
 print('missing:', ','.join(missing))
 tmp=path.with_suffix('.tmp')
 tmp.write_text(json.dumps({'date':day,'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'expected':len(expected),'missing':missing,'races':data},ensure_ascii=False),encoding='utf-8')
 tmp.replace(path)
 print(day,len(data),'racecards')
if __name__=='__main__': main()
