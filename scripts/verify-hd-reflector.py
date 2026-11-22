# Эталон режима Рефлектора: Swiss Ephemeris + те же независимые таблицы, что в verify-hd-transits.py.
# Запуск: python scripts/verify-hd-reflector.py EPHE > fixtures/hd-reflector-swisseph.json
import sys, os, json, datetime as dt
from zoneinfo import ZoneInfo
_here=os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(_here,'verify-hd-transits.py'),encoding='utf-8').read().split('# Независимый эталон')[0])
UTC=dt.timezone.utc
b=dt.datetime(1988,3,31,7,50,tzinfo=UTC)
c=chart(b)
tz=ZoneInfo('Asia/Yekaterinburg')
out=[]
d0=dt.date(2026,11,22)
for i in range(28):
    d=d0+dt.timedelta(days=i)
    t0=dt.datetime(d.year,d.month,d.day,tzinfo=tz).astimezone(UTC); t1=(dt.datetime(d.year,d.month,d.day,tzinfo=tz)+dt.timedelta(days=1)).astimezone(UTC)
    ev=gate_changes(t0,t1)
    cuts=[t0]+[e[0] for e in ev]+[t1]
    mg=[];chs=set();cs=set()
    for a,z in zip(cuts,cuts[1:]):
        if (z-a).total_seconds()<2: continue
        m=a+(z-a)/2; L=lons(m); G={k:gl(v[0])[0] for k,v in L.items()}
        if not mg or mg[-1]!=G['moon']: mg.append(G['moon'])
        gs=set(c['gates'])|set(G.values())
        allch=chans(gs)
        for ch in allch:
            if ch[0] in c['gates'] or ch[1] in c['gates']: chs.add('%d-%d'%tuple(sorted(ch)) )
        cs|=centers(allch)
    out.append(dict(key=str(d),moonGates=mg,channels=sorted(chs),centers=sorted(cs)))
rets=[]
for s in ['2026-11-22T10:40:00','2026-12-03T00:00:00','2027-01-15T18:30:00']:
    st=dt.datetime.fromisoformat(s).replace(tzinfo=UTC); g=gl(lons(st)['moon'][0])[0]
    t=st+dt.timedelta(days=20)
    while gl(lons(t)['moon'][0])[0]==g: t-=dt.timedelta(hours=1)
    while gl(lons(t+dt.timedelta(hours=1))['moon'][0])[0]!=g: t+=dt.timedelta(hours=1)
    lo,hi=t,t+dt.timedelta(hours=1)
    while (hi-lo).total_seconds()>1:
        m=lo+(hi-lo)/2
        if gl(lons(m)['moon'][0])[0]==g: hi=m
        else: lo=m
    rets.append(dict(start=s+'Z',gate=g,end=hi.isoformat().replace('+00:00','Z')[:19]+'Z'))
json.dump(dict(birth='1988-03-31T07:50:00Z',type=c['type'],profile=c['profile'],gates=sorted(c['gates']),tz='Asia/Yekaterinburg',month=out,returns=rets),sys.stdout,ensure_ascii=False,indent=1)
