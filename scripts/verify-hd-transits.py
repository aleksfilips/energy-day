# Независимая проверка транзитов Дизайна человека (Swiss Ephemeris + свои таблицы).
# Запуск: pip install pyswisseph; python scripts/verify-hd-transits.py EPHE > fixtures/hd-transits-swisseph.json
# EPHE — папка с sepl_18.se1 и semo_18.se1 (github.com/aloistr/swisseph, папка ephe).
# Independent Human Design calculator: Swiss Ephemeris (full SE files), own tables.
import swisseph as swe, sys, json, datetime as dt
swe.set_ephe_path(sys.argv[1] if len(sys.argv)>1 and sys.argv[1]!='-' else None)
ORDER=[41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,20,16,35,45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60]
CEN={'head':[64,61,63],'ajna':[47,24,4,17,11,43],'throat':[62,23,56,16,20,31,8,33,35,12,45],
'g':[1,13,25,46,2,15,10,7],'heart':[21,40,26,51],'spleen':[48,57,44,50,32,28,18],
'solar':[6,37,22,36,30,55,49],'sacral':[5,14,29,59,9,3,42,27,34],'root':[53,60,52,19,39,41,58,38,54]}
G2C={g:c for c,gs in CEN.items() for g in gs}
CH=[(64,47),(61,24),(63,4),(17,62),(43,23),(11,56),(16,48),(20,57),(20,34),(20,10),(31,7),(8,1),(33,13),(45,21),(35,36),(12,22),(15,5),(2,14),(46,29),(10,34),(10,57),(25,51),(26,44),(40,37),(6,59),(34,57),(27,50),(3,60),(9,52),(42,53),(32,54),(28,38),(18,58),(19,49),(39,55),(30,41)]
assert len(CH)==36 and len(set(G2C))==64
BODIES=[('sun',swe.SUN),('earth',None),('moon',swe.MOON),('northNode',swe.TRUE_NODE),('southNode',None),('mercury',swe.MERCURY),('venus',swe.VENUS),('mars',swe.MARS),('jupiter',swe.JUPITER),('saturn',swe.SATURN),('uranus',swe.URANUS),('neptune',swe.NEPTUNE),('pluto',swe.PLUTO)]
FLAG=swe.FLG_SWIEPH|swe.FLG_SPEED
def jd(t): # t: aware datetime UTC
    return swe.julday(t.year,t.month,t.day,t.hour+t.minute/60+t.second/3600+t.microsecond/3.6e9)
def lons(t):
    j=jd(t); out={}
    for n,b in BODIES:
        if b is None: continue
        x,_=swe.calc_ut(j,b,FLAG); out[n]=(x[0],x[3])
    out['earth']=((out['sun'][0]+180)%360,out['sun'][1]); out['southNode']=((out['northNode'][0]+180)%360,out['northNode'][1])
    return out
def gl(lon):
    off=(lon-302)%360; i=int(off//5.625); line=int((off-i*5.625)//0.9375)+1
    return ORDER[i],min(line,6)
def chans(gates): return [c for c in CH if c[0] in gates and c[1] in gates]
def centers(chs): return {G2C[g] for c in chs for g in c}
def connected(chs,a,b):
    adj={}
    for x,y in chs:
        p,q=G2C[x],G2C[y]; adj.setdefault(p,set()).add(q); adj.setdefault(q,set()).add(p)
    seen={a}; st=[a]
    while st:
        c=st.pop()
        for n in adj.get(c,()):
            if n not in seen: seen.add(n); st.append(n)
    return b in seen
def chart(birth):
    sun=lons(birth)['sun'][0]; target=(sun-88)%360
    lo=birth-dt.timedelta(days=96); hi=birth-dt.timedelta(days=84)
    f=lambda t:((lons(t)['sun'][0]-target+180)%360)-180
    while (hi-lo).total_seconds()>1:
        m=lo+(hi-lo)/2
        if f(m)<0: lo=m
        else: hi=m
    des=lo
    P={k:gl(v[0]) for k,v in lons(birth).items()}; D={k:gl(v[0]) for k,v in lons(des).items()}
    gates={g for g,_ in P.values()}|{g for g,_ in D.values()}
    chs=chans(gates); cs=centers(chs)
    motors=['heart','solar','sacral','root']
    m2t=any(m in cs and connected(chs,m,'throat') for m in motors)
    typ='reflector' if not cs else ('mg' if m2t else 'generator') if 'sacral' in cs else ('manifestor' if m2t else 'projector')
    auth='lunar' if not cs else 'emotional' if 'solar' in cs else 'sacral' if 'sacral' in cs else 'splenic' if 'spleen' in cs else 'ego' if 'heart' in cs else 'self' if ('g' in cs and connected(chs,'g','throat')) else 'mental/none'
    return dict(design=des,P=P,D=D,gates=gates,chs=chs,centers=cs,type=typ,auth=auth,profile=(P['sun'][1],D['sun'][1]))
def gate_changes(t0,t1,step=600):
    """all gate-change events for each body between t0,t1 (UTC), to 1 s"""
    ev=[]; t=t0; prev=lons(t); pg={k:gl(v[0])[0] for k,v in prev.items()}
    while t<t1:
        n=min(t+dt.timedelta(seconds=step),t1); cur=lons(n); cg={k:gl(v[0])[0] for k,v in cur.items()}
        for k in cg:
            if cg[k]!=pg[k]:
                lo,hi=t,n
                while (hi-lo).total_seconds()>1:
                    m=lo+(hi-lo)/2
                    if gl(lons(m)[k][0])[0]==pg[k]: lo=m
                    else: hi=m
                ev.append((hi,k,pg[k],cg[k]))
        pg=cg; t=n
    return sorted(ev)
# Независимый эталон транзитов: Swiss Ephemeris + собственные таблицы → fixtures/hd-transits-swisseph.json
import sys, json, datetime as dt
from zoneinfo import ZoneInfo
Z=lambda t:t.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z')[:19]+'Z'
def day_bounds(key,tz):
    y,m,d=map(int,key.split('-')); z=ZoneInfo(tz)
    a=dt.datetime(y,m,d,tzinfo=z); n=dt.date(y,m,d)+dt.timedelta(days=1)
    b=dt.datetime(n.year,n.month,n.day,tzinfo=z)
    return a.astimezone(dt.timezone.utc),b.astimezone(dt.timezone.utc)
def merge(ws):
    out=[]
    for a,b in ws:
        if out and out[-1][1]==a: out[-1]=(out[-1][0],b)
        else: out.append((a,b))
    return [[Z(a),Z(b)] for a,b in out]
cases=[]
CH_SORTED=lambda x:'-'.join(map(str,sorted(x)))
for name,birth,tz,start,n in [
    ('synthetic-1985', dt.datetime(1985,3,10,9,30,tzinfo=dt.timezone.utc),'Asia/Yekaterinburg','2026-11-15',30),
    ('ra-uru-hu', dt.datetime(1948,4,9,5,5,tzinfo=dt.timezone.utc),'Europe/Berlin','2026-03-26',6),
    ('ra-uru-hu', dt.datetime(1948,4,9,5,5,tzinfo=dt.timezone.utc),'America/New_York','2026-10-30',5),
    ('synthetic-1985', dt.datetime(1985,3,10,9,30,tzinfo=dt.timezone.utc),'Asia/Kolkata','2027-12-04',4),
]:
    c=chart(birth); NAT=c['gates']; natch={CH_SORTED(x) for x in c['chs']}
    days=[]
    d0=dt.date.fromisoformat(start)
    for i in range(n):
        key=(d0+dt.timedelta(days=i)).isoformat(); f,t=day_bounds(key,tz)
        ev=[e for e in gate_changes(f-dt.timedelta(hours=1),t+dt.timedelta(hours=1),step=600) if f<e[0]<t]
        bounds=[f]+sorted({e[0] for e in ev})+[t]
        chs={};cen={};hits={}
        for a,b in zip(bounds,bounds[1:]):
            m=a+(b-a)/2; g={k:gl(v[0])[0] for k,v in lons(m).items()}
            allg=NAT|set(g.values())
            cur=[x for x in CH if x[0] in allg and x[1] in allg]
            for x in cur:
                k=CH_SORTED(x)
                if k in natch: continue
                kind='completes' if (x[0] in NAT or x[1] in NAT) else 'transit-only'
                chs.setdefault(k,[kind,[]])[1].append((a,b))
            for cc in centers(cur)-c['centers']: cen.setdefault(cc,[]).append((a,b))
            for body,gg in g.items():
                if gg in NAT: hits.setdefault(f'{body}:{gg}',[]).append((a,b))
        days.append({'key':key,'from':Z(f),'to':Z(t),
            'changes':[[Z(e[0]),e[1],e[2],e[3]] for e in ev],
            'channels':{k:{'kind':v[0],'windows':merge(v[1])} for k,v in sorted(chs.items())},
            'centers':{k:merge(v) for k,v in sorted(cen.items())},
            'hits':{k:merge(v) for k,v in sorted(hits.items())}})
    cases.append({'chart':name,'birthUtc':Z(birth),'timeZone':tz,
        'expectChart':{'type':c['type'],'authority':c['auth'],'profile':list(c['profile']),'channels':sorted(CH_SORTED(x) for x in c['chs']),'gates':sorted(NAT)},
        'days':days})
print(json.dumps({'source':'Swiss Ephemeris %s (pyswisseph, полные файлы sepl_18/semo_18), True Node; ворота, каналы, центры и границы суток посчитаны независимо от кода приложения (Python, zoneinfo). Скрипт: scripts/verify-hd-transits.py'%swe.version,
  'note':'ra-uru-hu: Ра Уру Ху, 9.04.1948 00:05, Монреаль (данные из материалов курса Rave ABC); synthetic-1985: условная дата для тестов.',
  'cases':cases},ensure_ascii=False,indent=1))
