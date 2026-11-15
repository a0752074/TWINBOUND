export const VERSION = '9.0.0';
export const DURATION = 600;
export const G0 = 9.80665;
export const C = 299792458;
export const YEAR = 365.25 * 86400;
export const LY_KM = C * YEAR / 1000;
export const LEVELS = [
  {id:'moon', name:'Moon', en:'MOON', number:'01', difficulty:'Beginner', rank:1, color:'#bfcdf8', glow:'#7a91cc', description:'Your first journey beyond Earth.', detail:'A gentle route with more supplies and no black holes.', distance:384400, score:1, speed:165, density:.72, blackholes:false, orbit:'nbody', default:{heading:51.78670010044817, pitch:10.076562754690135, speed:3.7708823643311233}, range:[2.6,4.8,.005], near:30000, durationDays:14, departure:0, offset:[31024.857881820677,38272.978244934086,8522.753643913371]},
  {id:'mars', name:'Mars', en:'MARS', number:'02', difficulty:'Intermediate', rank:2, color:'#f1ac8b', glow:'#bd665a', description:'Explore the red planet.', detail:'Dodge clusters of rocks and watch for fictional gravity traps later in the flight.', distance:225000000, score:1.35, speed:185, density:1, blackholes:true, orbit:'nbody', default:{heading:168.86240955271947, pitch:3.5952872604908213, speed:5.960737471425201}, range:[4,8,.01], near:100000, durationDays:150, departure:796.286140684655, offset:[-732622.5546630707,153838.7363042145,45802.135444603045]},
  {id:'pluto', name:'Pluto', en:'PLUTO', number:'03', difficulty:'Hard', rank:3, color:'#d4c0b6', glow:'#8c768f', description:'Reach the edge of the planetary system.', detail:'Denser ice fields, fewer power supplies, and fictional gravity traps.', distance:5906000000, score:1.8, speed:205, density:1.28, blackholes:true, orbit:'kepler', default:{heading:90,pitch:0,speed:41.59840709115942}, range:[30,50,.01], near:18000000},
  {id:'proxima', name:'Proxima Centauri', en:'PROXIMA', number:'04', difficulty:'Expert', rank:4, color:'#e3a8c6', glow:'#a265b1', description:'One journey, two clocks.', detail:'The hardest route. Compare Earth and onboard clocks using an ideal interstellar drive.', distance:4.2465*LY_KM, score:2.3, speed:220, density:1.5, blackholes:true, orbit:'relativistic', default:{heading:90,pitch:0,speed:.8}, range:[.3,.95,.005], near:0}
];
export const EQUIPMENT = {
  engine:{name:'Engine', icon:'engine', color:'#ffbe87', items:[
    {name:'Spark',tier:'Basic',tag:'Lower cost; more refueling',price:85000, mass:58, thrust:14000, isp:180, fuel:180, bonus:.35, detail:'Isp 180 s · Thrust 14 kN · Fuel 180 kg', note:'Lower specific impulse uses more fuel for each maneuver.'},
    {name:'Cruiser',tier:'Standard',tag:'Balanced propulsion',price:240000,mass:78,thrust:15000,isp:285,fuel:220,bonus:.16,detail:'Isp 285 s · Thrust 15 kN · Fuel 220 kg',note:'A balance of thrust, fuel capacity, and cost.'},
    {name:'Meteor',tier:'Advanced',tag:'Higher fuel efficiency',price:680000,mass:95,thrust:16000,isp:420,fuel:260,bonus:0,detail:'Isp 420 s · Thrust 16 kN · Fuel 260 kg',note:'Higher specific impulse and a larger tank support repeated maneuvers.'}]},
  hull:{name:'Hull',icon:'hull',color:'#bbaff5',items:[
    {name:'Lightframe',tier:'Basic',tag:'One hit ends the flight',price:65000,mass:65,health:1,bonus:.35,detail:'Impact capacity 1  hits · Structure 65 kg',note:'A direct impact ends the flight. Near misses do not count as impacts.'},
    {name:'Reinforced',tier:'Standard',tag:'Room for mistakes',price:190000,mass:105,health:3,bonus:.16,detail:'Impact capacity 3  hits · Structure 105 kg',note:'Brief protection follows an impact. A repair pickup restores one cell.'},
    {name:'Heavy shield',tier:'Advanced',tag:'More impact protection',price:520000,mass:155,health:5,bonus:0,detail:'Impact capacity 5  hits · Structure 155 kg',note:'Heavier protection reduces acceleration at the same thrust.'}]},
  power:{name:'Power system',icon:'power',color:'#9ce4cf',items:[
    {name:'Battery pack',tier:'Basic',tag:'Collect energy crystals',price:55000,mass:35,battery:100,generation:0,bonus:.35,detail:'100 Wh · Generation 0 W',note:'About three minutes of baseline endurance. Collect energy to keep flying.'},
    {name:'Solar wing',tier:'Standard',tag:'More battery capacity',price:210000,mass:65,battery:180,generation:350,bonus:.16,detail:'180 Wh · Average generation 350 W',note:'Generation is a gameplay constant; sunlight and solar distance are not modeled.'},
    {name:'Continuous power unit',tier:'Advanced',tag:'Longer endurance',price:730000,mass:110,battery:400,generation:950,bonus:0,detail:'400 Wh · Generation 950 W',note:'Long endurance, with the highest cost and mass.'}]}
};
export const DEFAULT_KIT = {engine:1,hull:1,power:1};
export function buildCraft(kit) {
  const safe = Object.fromEntries(Object.keys(EQUIPMENT).map(k=>[k, Number.isInteger(kit?.[k]) && kit[k]>=0 && kit[k]<3 ? kit[k] : DEFAULT_KIT[k]]));
  const engine=EQUIPMENT.engine.items[safe.engine], hull=EQUIPMENT.hull.items[safe.hull], power=EQUIPMENT.power.items[safe.power];
  return {kit:safe,engine,hull,power,dryMass:65+engine.mass+hull.mass+power.mass, maxFuel:engine.fuel,maxEnergy:power.battery,maxHealth:hull.health, price:120000+engine.price+hull.price+power.price, multiplier:1+engine.bonus+hull.bonus+power.bonus};
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const fmt=(v,n=0)=>Number(v).toLocaleString('en-US',{maximumFractionDigits:n});
export const usd=v=>'US$ '+fmt(v);
export function clock(seconds) {return `${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;}
export function distanceLabel(km) {return km>LY_KM*.01?`${fmt(km/LY_KM,3)} ly`:km>=1e9?`${fmt(km/1e9,2)} billion km`:`${fmt(km)} km`;}
export function missionTime(seconds) {return seconds>YEAR?`${fmt(seconds/YEAR,2)} yr`:seconds>86400?`${fmt(seconds/86400,2)} d`:`${fmt(seconds/3600,1)} h`;}
