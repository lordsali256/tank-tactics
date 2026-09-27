import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createEngine} from '../dist/server/engine.mjs';
const code=fs.readFileSync('dist/play.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function arena(){const nodes=new Map(),node=()=>({value:'',style:{},children:[],classList:{remove(){},toggle(){}},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},addEventListener(){},setAttribute(){},showModal(){},close(){},querySelector(){return{focus(){}}}});const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:node,querySelectorAll(){return[]}};Object.assign(document.getElementById('arena'),{width:920,height:560,getContext:()=>({})});const ctx=vm.createContext({document,window:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},performance:{now:()=>0},requestAnimationFrame(){},setTimeout,clearTimeout,Math,console,confirm:()=>true,fetch:async()=>{throw Error('offline')}});vm.runInContext(code,ctx);return text=>vm.runInContext(text,ctx)}
const run=arena();
assert.ok(Math.abs(run('W*H/(920*560)')-10)<1e-9);
assert.ok(run('buildings.length')>=50);assert.equal(run('pickups.length'),8);
run(`const b=buildings[0],prior=pickups.length;const seededRandom=random;random=()=>.1;damageBuilding(b,{damage:1000,radius:0});random=seededRandom;if(!b.destroyed||rocks.includes(b)||pickups.length!==prior+1)throw Error('Destroyed building must stop blocking and sometimes drop loot');const a=player;a.hp=50;a.reserve=0;a.ammo=0;collectPickup(a,{kind:'health'});if(a.hp!==100)throw Error('Health drop must heal 50');collectPickup(a,{kind:'ammo'});if(a.reserve!==40||a.ammo!==a.stats.mag)throw Error('Ammo drop must resupply');collectPickup(a,{kind:'overdrive'});if(a.powerTime!==10)throw Error('Powerup must activate');collectPickup(a,{kind:'shield'});if(a.shield!==40)throw Error('Shield drop must protect');squadTick(a,1);if(a.shield!==40)throw Error('Bonus shield must persist on a unit without a shield generator');`);
for(let i=0;i<20;i++)run(`mode='running';finish(true);if(levelReward.offerTypes.length!==3||new Set(levelReward.offerTypes).size!==3||levelReward.tacticOptions.length!==3||new Set(levelReward.tacticOptions.map(t=>t.kind)).size!==3)throw Error('Victory must offer three distinct units and three doctrines');`);
// Actual Round 2, including AI movement, damage, drops, targeting and reloads.
const round2=arena();round2(`round=2;resetPositions();mode='running';finish=function(win){mode=win?'won':'lost'};for(let i=0;i<10801&&mode==='running';i++)update(1/60);`);
assert.equal(round2('enemy.type'),'infantry');assert.equal(round2('mode'),'won');assert.ok(round2('player.hp')>80);
// Armor protects tanks from rifle fire, while dedicated rockets retain damage.
run(`mode='ready';resetPositions();player.hp=160;takeHit(player,{sourceType:'infantry',damage:30,penetration:0,owner:'rifle'});const rifleLoss=160-player.hp;player.hp=160;takeHit(player,{sourceType:'rocket',damage:30,penetration:0,owner:'rocket'});if((160-player.hp)<rifleLoss*7)throw Error('Rockets must retain antiarmor damage');`);
// Permanent rewards never modify scripts and persist between deployments.
run(`mode='running';finish(true);const priorScript=selectedUnit().unitScript;const upgrade=levelReward.tacticOptions[0];const base=unitStats();chooseReward(upgrade);if(selectedUnit().unitScript!==priorScript||nextBuff!==null||selectedUnit().upgrades[upgrade.kind]!==1)throw Error('Permanent reward corrupted script');mode='ready';deploy();if(nextBuff!==null||activeBuff!==null)throw Error('Round buff remains active');`);
const unit=(id,type)=>({id,type,tier:1,commands:['radar','gun','drive'],instruction:'leader tank-1\nall focus nearest',squadScript:'leader tank-1\nall focus nearest',equipment:{}});
const engine=createEngine([unit('a','tank')],[unit('b','infantry')],'urban',15);
let state=engine.state();state.buildings[0].hp=0;state.buildings[0].destroyed=true;state.pickups[0].used=true;
const restored=createEngine([unit('a','tank')],[unit('b','infantry')],'urban',15,state);restored.tick(.1);state=restored.state();assert.equal(state.buildings[0].destroyed,true);assert.equal(state.pickups[0].used,true);assert.ok(state.battleUnits[1].x>2000);
console.log('Expanded arena: 10× area, 3+3 reward choices, Round 2 tank victory, armor roles, destructible cover, four pickup types, permanent rewards and multiplayer restoration passed.');
