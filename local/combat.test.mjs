import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const script=fs.readFileSync(new URL('../dist/play.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function simulate(instruction,modelPlan=null){
 const elements=new Map();const element=()=>({textContent:'',value:'',style:{},children:[],classList:{remove(){},toggle(){}},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)},setAttribute(){},addEventListener(){},showModal(){},close(){},querySelector(){return {focus(){}}}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll(){return []}};
 document.getElementById('arena').width=920;document.getElementById('arena').height=560;document.getElementById('arena').getContext=()=>({});document.getElementById('prompt').value=instruction;
 const context=vm.createContext({document,localStorage:{getItem:()=>null,setItem(){},removeItem(){}},window:{},setTimeout,clearTimeout,performance:{now:()=>0},requestAnimationFrame(){},AbortSignal,fetch:async()=>{throw Error('test')},Math,console,confirm:()=>true});vm.runInContext(script,context);
 document.getElementById('prompt').value='leader tank-1\nall stance '+(/snip/i.test(instruction)?'sniper':'rush')+'\nall focus nearest';vm.runInContext('preview()',context);
 vm.runInContext(String.raw`
 if(roster.length!==1||roster[0].type!=='tank'||battleUnits.length!==2)throw Error('Run must start 1 tank vs 1 tank');if(enemy.hp!==120||enemy.maxHp!==120||player.hp!==160||!enemy.aiControlled||player.aiControlled)throw Error('Round 1 AI must have 120 HP and independent controls');mode='running';for(let n=0;n<180;n++)update(1/60);if(Math.abs(player.y-enemy.y)<10)throw Error('AI approach must differ from player movement');mode='ready';resetPositions();roster.push(newUnit('infantry'),newUnit('infantry'),newUnit('infantry'));economy.slots=8;activateUnit(roster.find(u=>u.type==='infantry').id);const before=roster.length;combineUnits('infantry',1);
 if(roster.length!==before-2||roster.filter(u=>u.type==='infantry'&&u.tier===2).length!==1)throw Error('Combine must consume exactly three matches');
 const upgrade=roster.find(u=>u.type==='infantry');if(!unlocked(upgrade).includes('duck')||unlocked(upgrade).includes('perch')||!commands.has('duck')||selectedUnit().id!==upgrade.id)throw Error('Tier commands incorrect');
 const count=roster.length;combineUnits('infantry',2);if(roster.length!==count)throw Error('Insufficient copies must not combine');
 roster.push(newUnit('infantry',2),newUnit('infantry',2));combineUnits('infantry',2);if(selectedUnit().tier!==3||!commands.has('retreat')||!commands.has('perch'))throw Error('Third star unlocks incorrect');
 for(const type of Object.keys(unitTypes)){if(!roster.some(u=>u.type===type))roster.push(newUnit(type));campaign.map=type==='boat'?'coast':'urban';activateUnit(roster.find(u=>u.type===type).id);if(player.stats.mag!==unitTypes[type].mag||player.type!==type)throw Error('Unit combat profile mismatch');}
 activateUnit(roster.find(u=>u.type==='tank').id);
 mode='running';finish(true);levelReward.offerTypes=['sniper','infantry','tank'];const recruitCount=roster.length;chooseReward({unitType:'sniper',action:'add'});if(roster.length!==recruitCount+1||round!==1||nextBuff!==null)throw Error('Recruit reward failed');
 chooseReward({unitType:'sniper',action:'add'});if(roster.length!==recruitCount+1)throw Error('Duplicate reward claim');
 completeLevelRewards();if(round!==1)throw Error('Must claim both reward pools');
 const boon=levelReward.tacticOptions[0];chooseReward(boon);completeLevelRewards();if(round!==2||nextBuff!==boon)throw Error('Independent tactic pool failed');
 economy.credits=1000;const credits=economy.credits,cost=slotCost(),slots=economy.slots;buySlot();if(economy.slots!==slots+1||economy.credits!==credits-cost)throw Error('Slot purchase failed');
 while(roster.length<economy.slots)roster.push(newUnit('sniper'));mode='running';finish(true);levelReward.offerTypes=['tank','sniper','artillery'];const full=roster.length;chooseReward({unitType:'tank',action:'add'});if(roster.length!==full||economy.reserve.tank!==1)throw Error('Full team must reserve reward');
 chooseReward(levelReward.tacticOptions[1]);completeLevelRewards();combineUnits('sniper',1);claimReserve('tank');if(economy.reserve.tank!==0||roster.length!==full-1)throw Error('Reserve claim failed');
 round=1;mode='ready';wins=0;
 const gearUnit=selectedUnit(),baseDamage=unitStats().damage;economy.credits=1000;buyGear('weapon-0');equipGear('weapon-0','weapon');if(unitStats().damage<=baseDamage)throw Error('Gear must change combat stats');renderStats();if($('statList').children.length!==39)throw Error('Expected 39 distinct stats');
 const original=roster.length;let rejected=false;try{safeImportedUnits({version:1,units:[{type:'invalid',tier:1}]})}catch{rejected=true}if(!rejected)throw Error('Invalid imports accepted');gearUnit.wins=99;const coins=campaign.cosmeticCoins;retireUnit();if(campaign.cosmeticCoins!==coins+5||roster.length!==original-1)throw Error('Retirement cap failed');
 for(let i=0;i<3;i++){mode='running';finish(false)}if(campaign.lives!==0)throw Error('Run must end after three defeats');resetRun();if(campaign.lives!==3||roster.length!==1||battleUnits.filter(t=>t.team==='enemy').length!==1)throw Error('New run must restore one tank and lives');
 roster.push(newUnit('infantry',2),newUnit('sniper'));$('prompt').value='leader tank-1\nall follow leader\ninfantry protect leader\nall focus weakest';saveProgram();resetPositions();const ally=battleUnits.find(t=>t.team==='player'&&t.type==='infantry'),leader=battleUnits.find(t=>t.team==='player'&&t.type==='tank');const enemyA=battleUnits.find(t=>t.team==='enemy');enemyA.x=leader.x+200;enemyA.y=leader.y;const vector=formationVector(ally,enemyA);if(!vector.action.startsWith('Protecting')||ally.x+vector.mx<=leader.x)throw Error('Protection must screen the leader');const sniper=battleUnits.find(t=>t.type==='sniper');if(!formationVector(sniper,enemyA).action.startsWith('Following'))throw Error('Follow must retain formation');if(chooseTarget(ally)!==enemyA)throw Error('Squad must share target');if(!parseSquadScript('all execute arbitrary code').errors.length)throw Error('Unknown orders rejected');resetRun();


 mode='ready';campaign.base=[];economy.credits=1000;buildBase(0,'repair');const support=battleUnits.find(t=>t.team==='player');support.x=150;support.y=80;support.hp=100;fieldBaseSupport(support,1);if(support.hp!==102)throw Error('Base repairs must heal');buildBase(1,'ammo');const supplied=battleUnits.find(t=>t.team==='player');supplied.x=150;supplied.y=230;supplied.reserve=50;fieldBaseSupport(supplied,1);if(supplied.reserve!==58)throw Error('Ammo depot must supply reserve');buildBase(2,'wall');const width=rocks.at(-1).w;upgradeBase(2);if(rocks.at(-1).w<=width)throw Error('Wall upgrade must improve screen');campaign.base=[];resetPositions();
 `,context);
 document.getElementById('prompt').value='leader tank-1\nall stance '+(/snip/i.test(instruction)?'sniper':'rush')+'\nall focus nearest';vm.runInContext('preview()',context);
 if(modelPlan)vm.runInContext('compiledPlan='+JSON.stringify(modelPlan)+';compiledText=$("prompt").value;',context);
 vm.runInContext('deploy();for(let n=0;n<10801&&mode==="running";n++)update(1/60);',context);
 return JSON.parse(vm.runInContext('JSON.stringify({events:damageEvents.length,mode,hp:player.hp,enemyHp:enemy.hp,x:player.x,y:player.y,ammo:player.ammo,plan})',context));
}
const rush=simulate('Rush the enemy and fire aggressively.'),sniper=simulate('Keep distance and aim like a sniper.');
assert.deepEqual(rush,simulate('Rush the enemy and fire aggressively.'),'same seed must replay the same battle');
assert.notEqual(rush.x,sniper.x);assert.ok(rush.events>0||sniper.events>0,'combat must deal damage');
const custom=simulate('Unusual tactics',{style:'balanced',preferred:400,cover:true,coverBelow:.8,evade:true,retreat:true,retreatBelow:.3,firePolicy:'inRange',explanation:'test'});
assert.equal(custom.plan.preferred,400);assert.equal(custom.plan.retreatBelow,.3);assert.ok(Number.isFinite(custom.x));
console.log(JSON.stringify({rush,sniper,custom},null,2));

