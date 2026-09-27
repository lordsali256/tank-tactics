// SquadScript 2: bounded data interpreted by combat. Never eval model output.
Object.assign(unitTypes,{
 medic:{name:'Medic',role:'Heals foot troops; light pistol',hp:85,damage:9,speed:82,range:180,reload:.7,mag:8,spread:.13,r:12},
 engineer:{name:'Engineer',role:'Repairs vehicles and supplies ammunition',hp:100,damage:11,speed:75,range:195,reload:.65,mag:10,spread:.12,r:12},
 scout:{name:'Scout car',role:'Fast reconnaissance and target marking',hp:95,damage:14,speed:125,range:245,reload:.6,mag:10,spread:.1,r:16}
});
unitTypes.helicopter.hp=70;
const unitUnlocks={tank:1,infantry:1,rocket:1,sniper:3,scout:2,medic:3,artillery:4,engineer:4,boat:5,helicopter:6};
function availableTypes(){return Object.keys(unitTypes).filter(type=>round>=unitUnlocks[type]&&(!unitTypes[type].water||campaign.map==='coast'))}
const squadFunctions=[
 ['General','advance','Advance toward the nearest enemy.'],
 ['General','withdraw','Move away from the nearest enemy.'],
 ['General','stop','Stop moving and fire from the current position.'],
 ['General','patrol','Patrol a 180-unit circle around the starting position.'],
 ['General','rally','Move within 60 units of the surviving leader.'],
 ['General','spread','Separate from nearby allies to reduce splash exposure.'],
 ['General','tighten','Stay within 45 units of the leader.'],
 ['General','kite','Keep 330 range while firing.'],
 ['General','orbit','Circle the nearest enemy at about 220 range.'],
 ['General','zigzag','Add alternating lateral evasion to movement.'],
 ['General','seek-health','Route toward the nearest health drop when damaged.'],
 ['General','seek-ammo','Route toward the nearest ammo drop when low.'],
 ['General','seek-shield','Route toward an available shield drop.'],
 ['General','seek-boost','Route toward an overdrive drop.'],
 ['General','reload','Reload a partial magazine when below half capacity.'],
 ['General','cooldown','Hold fire above 40% heat until the weapon cools.'],
 ['General','reserve-fire','Fire only in preferred range when ammo reserves are below 30.'],
 ['General','anti-air','Prioritize flying enemies.'],
 ['General','avoid-danger','Evade incoming projectiles and the volcanic crater.'],
 ['General','guard-point','Hold the starting position and defend it.'],
 ['Tank','brace','Take 20% less damage; move 35% slower.'],
 ['Tank','ram','Deal 18 collision damage every 3 seconds within contact range.'],
 ['Tank','hull-down','Seek cover at all health levels; armor improves near cover.'],
 ['Tank','armor-piercing','Gain 25% penetration; fire 20% slower.'],
 ['Tank','smoke','Create a 130-radius smoke screen for 3 seconds; 12-second cooldown, 20 energy.'],
 ['Infantry','sprint','Move 30% faster; fire 25% slower.'],
 ['Infantry','ambush','Deal 35% more damage while near cover.'],
 ['Infantry','suppress','Hits add 15 weapon heat to the target.'],
 ['Infantry','grenade','Throw a 30-damage grenade within 180 range; splash 65, cooldown 8 seconds, 15 energy.'],
 ['Helicopter','strafe','Fly perpendicular attack passes around the enemy.'],
 ['Helicopter','hover','Hold position with twice the aim accuracy.'],
 ['Helicopter','flare','Reduce incoming rocket damage 60% while energy is available; cooldown 5 seconds.'],
 ['Helicopter','rocket-pod','Add 40 splash and 15% damage; fire 40% slower.'],
 ['Rocket','lock-on','Double accuracy, add 15% penetration, and require a longer target lock.'],
 ['Rocket','backblast','Move backward after each rocket shot.'],
 ['Rocket','bunker-buster','Gain 70 splash radius; deal double damage to buildings.'],
 ['Artillery','barrage','Fire 40% faster at 70% shell damage.'],
 ['Artillery','siege','Hold position and deal triple damage to buildings.'],
 ['Artillery','displace','Move perpendicular to the target while reloading after a shot.'],
 ['Sniper','steady','Stop moving and double aim accuracy.'],
 ['Sniper','headshot','Gain 25 percentage points of critical chance against foot troops.'],
 ['Sniper','camouflage','Halve radar signature until 2 seconds after firing.'],
 ['Boat','broadside','Circle the target at naval firing range.'],
 ['Boat','depth-charge','Deal 35 splash damage to nearby boats within 90 range; cooldown 8 seconds, 15 energy.'],
 ['Medic','triage','Heal the most injured foot ally by 25 within 150 range; cooldown 6 seconds, 15 energy.'],
 ['Medic','field-hospital','Stop and heal nearby allies 3 HP/second within 110 range; drain 4 energy/second.'],
 ['Engineer','repair','Repair the most injured vehicle by 25 within 150 range; cooldown 6 seconds, 15 energy.'],
 ['Engineer','supply','Give a low-ammo ally 25 reserve rounds within 140 range; cooldown 8 seconds, 10 energy.'],
 ['Scout','scan','Boost nearby allies’ radar 30% for 4 seconds; cooldown 8 seconds, 15 energy.'],
 ['Scout','mark','Mark a target for 20% extra squad damage for 4 seconds; cooldown 8 seconds, 15 energy.']
].map(([group,name,description])=>({group,name,description}));
const functionByName=new Map(squadFunctions.map(fn=>[fn.name,fn]));
function groupType(group){return {Tank:'tank',Infantry:'infantry',Helicopter:'helicopter',Rocket:'rocket',Artillery:'artillery',Sniper:'sniper',Boat:'boat',Medic:'medic',Engineer:'engineer',Scout:'scout'}[group]}
function capacityFor(t){return t.tier===1?3:t.tier===2?5:7}
function conditionActive(t,c){if(!c)return true;const value=c.stat==='hp'?t.hp/t.maxHp:c.stat==='ammo'?t.ammo/t.stats.mag:c.stat==='energy'?t.energy/t.stats.energyCapacity:t.heat/t.stats.heatCapacity;return c.op==='below'?value<c.value:value>c.value}
parseSquadScript=function(text){if(orderCache.has(text))return orderCache.get(text);if(typeof text!=='string'||text.length>6001)return{leader:'tank-1',rules:[],errors:['SquadScript is combined limit is 6001 characters.']};const rules=[],errors=[];let leader='tank-1';const validSelector=value=>value==='all'||Object.keys(unitTypes).some(type=>value===type||new RegExp('^'+type+'-[1-9][0-9]?$').test(value));
 for(const [i,raw]of text.split('\n').entries()){let line=raw.trim().toLowerCase();if(!line||line.startsWith('#'))continue;let condition=null;const cm=line.match(/ when (hp|ammo|energy|heat) (below|above) ([0-9]{1,3})%$/);if(cm){if(+cm[3]>100){errors.push('Line '+(i+1)+': percent must be 0–100');continue}condition={stat:cm[1],op:cm[2],value:+cm[3]/100};line=line.slice(0,cm.index)}const words=line.split(/\s+/),selector=words.shift(),verb=words.shift(),arg=words.join(' ');let rule;
  if(selector==='leader'&&verb&&validSelector(verb)&&verb!=='all'&&verb.includes('-')&&!arg&&!condition){leader=verb;continue}
  if(!validSelector(selector)){errors.push('Line '+(i+1)+': unknown unit selector');continue}
  if(['follow','protect','flank'].includes(verb)&&(arg==='leader'||validSelector(arg)&&arg!=='all'&&arg.includes('-')))rule={kind:'formation',mode:verb,anchor:arg};
  else if(verb==='focus'&&['nearest','weakest','leader'].includes(arg))rule={kind:'focus',value:arg};
  else if(verb==='hold'&&/^\d{2,3}$/.test(arg)&&+arg>=100&&+arg<=500)rule={kind:'range',value:+arg};
  else if(verb==='stance'&&['rush','balanced','sniper'].includes(arg))rule={kind:'stance',value:arg};
  else if(verb==='retreat'&&/^below [0-9]{1,2}%$/.test(arg))rule={kind:'retreat',value:clamp(parseInt(arg.slice(6))/100,.05,.8)};
  else if(functionByName.has(verb)&&!arg){const fn=functionByName.get(verb),type=groupType(fn.group);if(type&&selector!=='all'&&selector!==type&&!selector.startsWith(type+'-')){errors.push('Line '+(i+1)+': '+verb+' belongs to '+fn.group);continue}rule={kind:'ability:'+verb,name:verb,unitType:type||null}}
  if(rule)rules.push({...rule,selector,condition});else errors.push('Line '+(i+1)+': unknown function or arguments “'+raw.trim()+'”');
 }const parsed={leader,rules,errors};if(orderCache.size>100)orderCache.clear();orderCache.set(text,parsed);return parsed};
ordersFor=function(t){const parsed=parseSquadScript(scriptFor(t)),name=callsign(t),result={},matching=parsed.rules.filter(r=>(r.selector==='all'||r.selector===t.type||r.selector===name)&&(!r.unitType||r.unitType===t.type)&&conditionActive(t,r.condition)&&(r.kind!=='retreat'||t.tier>=3));for(const rule of matching.slice(-capacityFor(t))){if(rule.kind==='retreat'&&t.tier<3)continue;result[rule.kind]=rule}return result};
const footTypes=new Set(['infantry','rocket','sniper','medic','engineer']);
function activeFunction(t,name){return !!t.activeFunctions?.includes(name)}
function cooldownAbility(t,name,seconds,energy,act){t.abilityTimers=t.abilityTimers||{};if(elapsed<(t.abilityTimers[name]||0)||t.energy<energy)return false;if(act()===false)return false;t.energy-=energy;t.abilityTimers[name]=elapsed+seconds;sparks.push({x:t.x,y:t.y,life:.4,color:'#73d8ff'});return true}
function nearestFoe(t){return battleUnits.filter(u=>u.team!==t.team&&u.hp>0).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y))[0]}
function injuredAlly(t,foot,range){return battleUnits.filter(u=>u.team===t.team&&u.hp>0&&u.hp<u.maxHp-1&&(foot===null||footTypes.has(u.type)===foot)&&Math.hypot(u.x-t.x,u.y-t.y)<range).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]}
function functionMotion(t,foe){const leader=leaderFor(t),f=t.activeFunctions||[],dx=(foe?.x||t.x)-t.x,dy=(foe?.y||t.y)-t.y,[nx,ny]=norm(dx,dy);let motion=null;const toward=(x,y,stop=25)=>Math.hypot(x-t.x,y-t.y)>stop?{mx:x-t.x,my:y-t.y,action:'Executing squad function'}:{mx:0,my:0,action:'Holding assigned position'};
 for(const fn of f){if(['stop','hover','steady','siege','field-hospital'].includes(fn))motion={mx:0,my:0,action:fn};if(fn==='advance'&&foe)motion={mx:nx,my:ny,action:'Advancing'};if(fn==='withdraw'&&foe)motion={mx:-nx,my:-ny,action:'Withdrawing'};if(fn==='guard-point')motion=toward(t.homeX,t.homeY);if(fn==='patrol')motion=toward(t.homeX+Math.cos(t.phase*.25)*180,t.homeY+Math.sin(t.phase*.25)*180);if(['rally','tighten'].includes(fn)&&leader&&leader!==t)motion=toward(leader.x,leader.y,fn==='tighten'?45:60);
  if(fn==='spread'){const close=battleUnits.find(a=>a!==t&&a.team===t.team&&a.hp>0&&Math.hypot(a.x-t.x,a.y-t.y)<90);if(close)motion={mx:t.x-close.x,my:t.y-close.y,action:'Spreading out'}}
  if(['orbit','strafe','broadside','displace'].includes(fn)&&foe&&(fn!=='displace'||t.cooldown>.3)){const range=fn==='broadside'?340:fn==='strafe'?180:220,d=Math.hypot(dx,dy),advance=d>range+35?.8:d<range-35?-.8:0;motion={mx:nx*advance-ny,my:ny*advance+nx,action:fn}}
  if(fn==='backblast'&&foe&&t.cooldown>t.stats.reload*.65)motion={mx:-nx,my:-ny,action:'Clearing backblast'};
  if(fn.startsWith('seek-')){const kind={'seek-health':'health','seek-ammo':'ammo','seek-shield':'shield','seek-boost':'overdrive'}[fn],drop=pickups.filter(p=>!p.used&&p.kind===kind&&pickupUseful(t,p)).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y))[0];if(drop)motion=toward(drop.x,drop.y,0)}
  if(fn==='avoid-danger'){const shot=shots.find(s=>s.team!==t.team&&Math.hypot(s.x-t.x,s.y-t.y)<90);if(shot)motion={mx:-shot.vy,my:shot.vx,action:'Avoiding incoming fire'};if(campaign.map==='volcanic'&&Math.hypot(t.x-W*.5,t.y-H*.22)<150)motion={mx:t.x-W*.5,my:t.y-H*.22,action:'Leaving hazard'}}
 }
 if(motion&&Math.hypot(motion.mx,motion.my)>.01&&activeFunction(t,'zigzag')&&foe){motion.mx-=ny*Math.sin(t.phase*6)*.7;motion.my+=nx*Math.sin(t.phase*6)*.7}
 if(motion&&!t.stats.flying&&Math.hypot(motion.mx,motion.my)>1&&lineBlocked(t.x,t.y,t.x+motion.mx,t.y+motion.my)){if(elapsed>=(t.functionRouteAt||0)){t.functionRoute=pathStep(t,{x:clamp(t.x+motion.mx,30,W-30),y:clamp(t.y+motion.my,30,H-30)});t.functionRouteAt=elapsed+.6}if(t.functionRoute)motion={...motion,mx:t.functionRoute[0]-t.x,my:t.functionRoute[1]-t.y}}
 t.suppressEvasion=!!motion&&Math.hypot(motion.mx,motion.my)<.01;
 return motion;
}
const previousFormation=formationVector;formationVector=function(t,foe){return functionMotion(t,foe)||previousFormation(t,foe)};
const previousAiMovement=aiMovement;aiMovement=function(t,foe){return functionMotion(t,foe)||previousAiMovement(t,foe)};
const previousTarget=chooseTarget;chooseTarget=function(t){if(activeFunction(t,'anti-air')){const air=battleUnits.filter(u=>u.team!==t.team&&u.hp>0&&u.stats.flying&&Math.hypot(u.x-t.x,u.y-t.y)<t.stats.radarRange).sort((a,b)=>a.hp-b.hp)[0];if(air)return air}return previousTarget(t)};
const tickBeforeFunctions=squadTick;squadTick=function(t,dt){if(t.hp<=0)return;t.baseStats=t.baseStats||{...t.stats};t.stats={...t.baseStats};t.basePlan=t.basePlan||{...t.plan};t.plan={...t.basePlan};const orders=ordersFor(t);t.activeFunctions=Object.values(orders).filter(r=>r.name).map(r=>r.name);const s=t.stats,foe=t.target?.hp>0?t.target:nearestFoe(t);t.functionFireHold=false;t.suppressEvasion=false;if(orders.range)t.plan.preferred=orders.range.value;if(orders.stance){t.plan.style=orders.stance.value;if(!orders.range&&!t.plan.modelApplied)t.plan.preferred=orders.stance.value==='rush'?145:orders.stance.value==='sniper'?360:s.range}if(orders.retreat){t.plan.retreat=true;t.plan.retreatBelow=orders.retreat.value}
 for(const fn of t.activeFunctions){switch(fn){
 case 'kite':t.plan.preferred=330;break;case 'zigzag':t.plan.evade=true;break;
 case 'reload':if(t.ammo<s.mag/2&&t.reloading<=0&&t.reserve>0)t.reloading=(s.mag-t.ammo)/s.loadingSpeed+s.reloadDelay;break;
 case 'cooldown':t.functionFireHold=t.heat>s.heatCapacity*.4;break;
 case 'reserve-fire':if(t.reserve<30)t.plan.firePolicy='inRange';break;
 case 'brace':s.speed*=.65;s.damageResistance=1-(1-s.damageResistance)*.8;break;
 case 'hull-down':t.plan.cover=true;t.plan.coverBelow=1;if(nearRock(t))s.armor=Math.min(.8,s.armor+.15);break;
 case 'armor-piercing':s.penetration+=.25;s.reload*=1.2;break;
 case 'sprint':s.speed*=1.3;s.reload*=1.25;break;
 case 'ambush':if(nearRock(t))s.damage*=1.35;break;
 case 'hover':case 'steady':s.accuracy*=2;break;
 case 'rocket-pod':s.explosionRadius+=40;s.damage*=1.15;s.reload*=1.4;break;
 case 'lock-on':s.accuracy*=2;s.penetration+=.15;s.targetLockTime=.4;break;
 case 'bunker-buster':s.explosionRadius+=70;break;
 case 'barrage':s.reload*=.6;s.damage*=.7;break;
 case 'headshot':if(foe&&footTypes.has(foe.type))s.critChance+=.25;break;
 case 'camouflage':if(elapsed-(t.lastFiredAt??-10)>2)s.stealthSignature*=.5;break;
 case 'ram':if(foe&&Math.hypot(foe.x-t.x,foe.y-t.y)<t.r+foe.r+8)cooldownAbility(t,fn,3,0,()=>takeHit(foe,{damage:18,penetration:.3,owner:t.id,team:t.team,sourceType:t.type}));break;
 case 'smoke':cooldownAbility(t,fn,12,20,()=>{for(const a of battleUnits)if(a.hp>0&&a.team!==t.team&&Math.hypot(a.x-t.x,a.y-t.y)<130)a.smokedUntil=elapsed+3});break;
 case 'grenade':case 'depth-charge':{const target=fn==='depth-charge'?battleUnits.filter(u=>u.hp>0&&u.team!==t.team&&u.stats.water&&Math.hypot(u.x-t.x,u.y-t.y)<90).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y))[0]:foe;if(target&&Math.hypot(target.x-t.x,target.y-t.y)<(fn==='grenade'?180:90))cooldownAbility(t,fn,8,15,()=>{for(const u of battleUnits)if(u.hp>0&&u.team!==t.team&&(fn!=='depth-charge'||u.stats.water)&&Math.hypot(u.x-target.x,u.y-target.y)<(fn==='grenade'?65:90))takeHit(u,{damage:fn==='grenade'?30:35,penetration:.05,owner:t.id,team:t.team,sourceType:t.type})});break}
 case 'triage':case 'repair':{const a=injuredAlly(t,fn==='triage',150);if(a)cooldownAbility(t,fn,6,15,()=>{a.hp=Math.min(a.maxHp,a.hp+25)});break}
 case 'field-hospital':if(t.energy>4*dt){const patients=battleUnits.filter(a=>a.team===t.team&&a.hp>0&&a.hp<a.maxHp&&Math.hypot(a.x-t.x,a.y-t.y)<110);if(patients.length){for(const a of patients)a.hp=Math.min(a.maxHp,a.hp+3*dt);t.energy-=4*dt}}break;
 case 'supply':{const a=battleUnits.find(a=>a.team===t.team&&a.hp>0&&a.reserve<60&&Math.hypot(a.x-t.x,a.y-t.y)<140);if(a)cooldownAbility(t,fn,8,10,()=>a.reserve=Math.min(250,a.reserve+25));break}
 case 'scan':cooldownAbility(t,fn,8,15,()=>{for(const a of battleUnits)if(a.hp>0&&a.team===t.team&&Math.hypot(a.x-t.x,a.y-t.y)<300)a.scanBoostUntil=elapsed+4});break;
 case 'mark':if(foe&&Math.hypot(foe.x-t.x,foe.y-t.y)<s.radarRange)cooldownAbility(t,fn,8,15,()=>{foe.markedUntil=elapsed+4;foe.markedBy=t.team});break;
 }}if(t.scanBoostUntil>elapsed)s.radarRange*=1.3;if(t.smokedUntil>elapsed)s.accuracy*=.6;
 // Partial reload returns rounds to reserve once, avoiding duplication.
 if(activeFunction(t,'reload')&&t.reloading>0&&t.ammo>0){t.reserve+=t.ammo;t.ammo=0}
 autonomousTick(t,dt);
};
const fireBeforeFunctions=squadFire;squadFire=function(t,target){if(t.functionFireHold)return;fireBeforeFunctions(t,target);t.lastFiredAt=elapsed;const shot=shots.at(-1);if(shot){shot.suppress=activeFunction(t,'suppress');shot.buildingMultiplier=activeFunction(t,'siege')?3:activeFunction(t,'bunker-buster')?2:1}};
const hitBeforeFunctions=takeHit;takeHit=function(t,shot,scale=1){if(t.markedUntil>elapsed&&t.markedBy===shot.team)scale*=1.2;if(activeFunction(t,'flare')&&shot.sourceType==='rocket'&&cooldownAbility(t,'flare',5,10,()=>true))scale*=.4;hitBeforeFunctions(t,shot,scale);if(shot.suppress&&t.hp>0)t.heat=Math.min(t.stats.heatCapacity,t.heat+15)};
const buildingBeforeFunctions=damageBuilding;damageBuilding=function(b,shot){buildingBeforeFunctions(b,{...shot,damage:shot.damage*(shot.buildingMultiplier||1)})};
const spawnBeforeFunctions=spawnCombat;spawnCombat=function(u,team,index,count){const t=spawnBeforeFunctions(u,team,index,count);t.homeX=t.x;t.homeY=t.y;if(t.aiControlled){t.stats={...t.stats,damage:t.stats.damage*.8};const special={medic:'triage',engineer:'repair',scout:'mark',helicopter:'strafe',tank:'brace',infantry:'suppress',rocket:'lock-on',artillery:'displace',sniper:'steady',boat:'broadside'}[u.type];t.squadScript='leader tank-1\nall focus nearest\n'+(special?u.type+' '+special:'all advance')}t.baseStats={...t.stats};return t};
function pickupUseful(t,p){if(p.kind==='health')return t.hp<t.maxHp-5;if(p.kind==='ammo')return t.reserve<t.stats.ammoReserve||t.ammo<t.stats.mag/2;if(p.kind==='shield')return t.shield<30;return !(t.powerTime>0)}
collectPickup=function(t,p){if(p.used||!pickupUseful(t,p))return;p.used=true;let effect='';if(p.kind==='health'){const healed=Math.min(50,t.maxHp-t.hp);t.hp+=healed;effect='+'+Math.round(healed)+' HP'}if(p.kind==='ammo'){t.reserve=Math.min(250,t.reserve+40);t.ammo=t.stats.mag;t.reloading=0;effect='+40 ammo · magazine refilled'}if(p.kind==='overdrive'){t.powerTime=10;effect='Overdrive · 10s speed/fire boost'}if(p.kind==='shield'){t.shield=Math.max(t.shield,40);effect='+40 shield'}t.pickupEffect=effect;t.pickupEffectUntil=elapsed+4;sparks.push({x:t.x,y:t.y,life:.8,color:p.kind==='health'?'#69f6a6':'#72caff'});if(t.team==='player')message(callsign(t)+' collected '+effect)};
// Death records stay in simulation for stable callsigns/results; renderer removes meshes.
let autoRestart=false,autoRestartTimer=null;try{autoRestart=localStorage.getItem('tank-auto-restart')==='true'}catch{}$('autoRestart').checked=autoRestart;
$('autoRestart').onchange=()=>{autoRestart=$('autoRestart').checked;try{localStorage.setItem('tank-auto-restart',String(autoRestart))}catch{}if(!autoRestart&&autoRestartTimer)clearTimeout(autoRestartTimer)};
const finishBeforeRetry=finish;finish=function(win){finishBeforeRetry(win);if(!win&&autoRestart&&!replaying&&!onlinePlaying&&mode==='lost'&&campaign.lives>0){const retryRound=round;message('Retrying Round '+round+' in 3 seconds · '+campaign.lives+' lives left');autoRestartTimer=setTimeout(()=>{if(autoRestart&&mode==='lost'&&round===retryRound&&campaign.lives>0&&!onlinePlaying&&!compiling)deploy()},3000)}};
const deployBeforeUnlock=deploy;deploy=function(){if(roster.some(u=>u.deployed!==false&&round<(unitUnlocks[u.type]||1))){$('message').textContent='Bench locked units first. Helicopters unlock at Round 6; the function guide lists other unlocks.';return}deployBeforeUnlock()};$('deploy').onclick=()=>deploy();
function renderFunctionGuide(){const root=$('functionGuide');root.replaceChildren();const intro=document.createElement('p');intro.textContent='SquadScript 2: selector function [when hp|ammo|energy|heat below|above N%]. One order per line. All, a type, or callsign selects units. ★ executes the latest 3 matching active orders; ★★ 5; ★★★ 7. Unsupported lines are rejected. Local AI drafts scripts; review and Apply before deploying.';root.append(intro);const legacy=document.createElement('p');legacy.textContent='General core: leader tank-1; all follow leader; infantry protect leader; helicopter flank leader; all focus nearest|weakest|leader; all hold 100–500; all stance rush|balanced|sniper; all retreat below 25% (★★★). Later matching settings override earlier ones. # starts a comment.';root.append(legacy);
 for(const group of ['General',...Object.keys(unitTypes).map(type=>squadFunctions.find(f=>groupType(f.group)===type)?.group).filter(Boolean)]){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=group==='General'?'General':unitTypes[groupType(group)].name+' · Round '+unitUnlocks[groupType(group)];details.append(summary);for(const fn of squadFunctions.filter(f=>f.group===group)){const p=document.createElement('p');p.textContent=(group==='General'?'all':groupType(group))+' '+fn.name+' — '+fn.description;details.append(p)}root.append(details)}}
$('functionHelp').onclick=()=>{renderFunctionGuide();$('functionDialog').showModal()};$('closeFunctions').onclick=()=>$('functionDialog').close();
