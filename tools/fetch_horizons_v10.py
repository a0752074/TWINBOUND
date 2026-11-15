"""Development-only: download official geometric JPL states, sequential requests.

Runtime is offline. All times are TDB; states are barycentric Ecliptic J2000.
"""
from pathlib import Path
import urllib.request, urllib.parse, json, gzip, hashlib, time
import math
import struct

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/horizons_v10'
OUT.mkdir(parents=True,exist_ok=True)
START='2025-01-01'
END='2051-01-01'
BODIES=[('sun','10',1),('mercury','199',.25),('venus','299',.5),('earth','399',.25),('moon','301',.125),('mars','499',1),('jupiter','5',1),('saturn','6',2),('uranus','7',2),('neptune','8',2),('pluto','9',2)]
old=json.loads((ROOT/'data/gravity_v3.json').read_text())['bodies']
sources=[]
for name,command,step in BODIES:
    cache=OUT/(name+'.json.gz')
    params={'format':'json','COMMAND':"'"+command+"'",'OBJ_DATA':"'YES'",'MAKE_EPHEM':"'YES'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@0'",'START_TIME':"'"+START+"'",'STOP_TIME':"'"+END+"'",'STEP_SIZE':"'"+str(int(step*1440))+" min'",'OUT_UNITS':"'AU-D'",'REF_PLANE':"'ECLIPTIC'",'REF_SYSTEM':"'ICRF'",'VEC_CORR':"'NONE'",'VEC_TABLE':"'2'",'CSV_FORMAT':"'YES'",'TIME_TYPE':"'TDB'"}
    if not cache.exists():
        url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
        print('Fetching',name,flush=True)
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url,timeout=180) as response:
                    raw=response.read()
                payload=json.loads(raw)
                if '$$SOE' not in payload.get('result',''):raise ValueError(str(payload)[:800])
                cache.write_bytes(gzip.compress(raw,mtime=0))
                break
            except Exception as e:
                print(name,'attempt',attempt+1,type(e).__name__,str(e)[:500],flush=True)
                if attempt==2:raise
                time.sleep(2)
    raw=gzip.decompress(cache.read_bytes())
    payload=json.loads(raw);text=payload['result']
    rows=[]
    for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
        parts=[p.strip() for p in line.split(',')]
        rows.append([float(parts[0])]+[float(x) for x in parts[2:8]])
    if not rows or not all(math.isfinite(x) for row in rows for x in row) or any(abs(rows[i][0]-rows[i-1][0]-step)>1e-7 for i in range(1,len(rows))):raise ValueError(name+' invalid ephemeris')
    with (OUT/(name+'.bin')).open('wb') as binary:
        for row in rows:
            binary.write(struct.pack('<6d',*row[1:]))
    gm=975.5 if name=='pluto' else old[name]['gm_km3_s2']
    radius=1188.3 if name=='pluto' else old[name]['radius_km']
    sources.append({'name':name,'command':command,'step_days':step,'samples':len(rows),'start_jd':rows[0][0],'end_jd':rows[-1][0],'gm_km3_s2':gm,'radius_km':radius,'file':name+'.bin','raw_file':name+'.json.gz','raw_sha256':hashlib.sha256(raw).hexdigest(),'binary_sha256':hashlib.sha256((OUT/(name+'.bin')).read_bytes()).hexdigest(),'parameters':params,'signature':payload.get('signature'),'header':text.split('$$SOE')[0]})
    print(name,len(rows),'samples',flush=True)
meta={'format':'twinbound-jpl-v10','source_url':'https://ssd.jpl.nasa.gov/api/horizons.api','frame':'Solar System Barycenter; Ecliptic J2000; geometric; AU and AU/day','timescale':'TDB','epoch':START,'start_jd':sources[0]['start_jd'],'end_jd':sources[0]['end_jd'],'launch_min':'2025-01-01','launch_max':'2030-12-31','bodies':sources,'note':'Official Horizons sampled states; cubic Hermite interpolation is an approximation. Outer planets and Pluto use system barycenters; Pluto+Charon GM=975.5 km3/s2. No extrapolation.'}
(OUT/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print('All official Horizons data saved.',flush=True)
