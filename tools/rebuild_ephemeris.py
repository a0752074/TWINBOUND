"""Optional development tool; NOT required to play.

Rebuild the 3-hour ephemeris from bundled V8/JPL initial conditions.
Install numpy and scipy in a development environment before invoking this.
"""
from pathlib import Path
import json
import numpy as np
from scipy.integrate import solve_ivp

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'data/gravity_v3.json').read_text(encoding='utf-8'))
names=('sun','mercury','venus','earth','moon','mars','jupiter','saturn','uranus','neptune')
AU=149597870700.
DAY=86400.
bodies=data['bodies']
mu_si=np.array([bodies[k]['gm_km3_s2']*1e9 for k in names])
mu=mu_si*DAY**2/AU**3
r=np.array([bodies[k]['state_km_kms'][:3] for k in names])*1000/AU
v=np.array([bodies[k]['state_km_kms'][3:] for k in names])*1000*DAY/AU
r-=np.average(r,axis=0,weights=mu)
v-=np.average(v,axis=0,weights=mu)
y=np.r_[r.ravel(),v.ravel()]

def rhs(t,state):
    positions=state[:30].reshape(10,3)
    delta=positions[None,:,:]-positions[:,None,:]
    d2=np.einsum('ijk,ijk->ij',delta,delta)
    np.fill_diagonal(d2,np.inf)
    acceleration=np.sum(delta*(mu[None,:]/d2**1.5)[:,:,None],axis=1)
    return np.r_[state[30:],acceleration.ravel()]

times=np.arange(0,1024.0001,.125)
states=np.empty((len(times),60),dtype='<f8')
for start in range(0,1024,128):
    end=start+128
    solution=solve_ivp(rhs,(start,end),y,method='DOP853',rtol=2e-12,atol=2e-14,max_step=1,dense_output=True)
    if not solution.success:
        raise SystemExit(solution.message)
    mask=(times>=start)&(times<=end)
    states[mask]=solution.sol(times[mask]).T
    y=solution.y[:,-1]
    print(f'Integrated {end}/1024 days',flush=True)
states.tofile(root/'data/ephemeris.bin')
meta={'format':'twinbound-ephemeris-v9','step_days':.125,'samples':len(times),'units':'AU and AU/day','layout':'little endian float64: each sample has xyz positions of 10 bodies followed by xyz velocities of 10 bodies','names':names,'mu_au3_day2':mu.tolist(),'radii_km':[bodies[k]['radius_km'] for k in names],'au_km':AU/1000,'epoch':data['epoch'],'source':'Bundled V8 NASA/JPL initial states, same Newtonian N-body equations; DOP853 dense solution sampled at 3-hour intervals. Cubic Hermite interpolation in browser.'}
(root/'data/ephemeris.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
print('Ephemeris rebuilt. Run the orbit tests before packaging.')
