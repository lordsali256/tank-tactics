import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const script=fs.readFileSync(new URL('../dist/play.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function simulate(instruction,modelPlan=null){
 const elements=new Map();const element=()=>({textContent:'',value:'',style:{},classList:{remove(){},toggle(){}},replaceChildren(){},append(){},setAttribute(){},addEventListener(){},showModal(){},close(){},querySelector(){return {focus(){}}}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll(){return []}};
 document.getElementById('arena').width=920;document.getElementById('arena').height=560;document.getElementById('arena').getContext=()=>({});document.getElementById('prompt').value=instruction;
 const context=vm.createContext({document,performance:{now:()=>0},requestAnimationFrame(){},AbortSignal,fetch:async()=>{throw Error('test')},Math,console});vm.runInContext(script,context);
 if(modelPlan)vm.runInContext('compiledPlan='+JSON.stringify(modelPlan)+';compiledText=$("prompt").value;',context);
 vm.runInContext('deploy();for(let n=0;n<2701&&mode==="running";n++)update(1/60);',context);
 return JSON.parse(vm.runInContext('JSON.stringify({mode,hp:player.hp,enemyHp:enemy.hp,x:player.x,y:player.y,ammo:player.ammo,plan})',context));
}
const rush=simulate('Rush the enemy and fire aggressively.'),sniper=simulate('Keep distance and aim like a sniper.');
assert.deepEqual(rush,simulate('Rush the enemy and fire aggressively.'),'same seed must replay the same battle');
assert.notEqual(rush.plan.preferred,sniper.plan.preferred);assert.ok(rush.enemyHp<140||sniper.enemyHp<140,'combat must deal damage');
const custom=simulate('Unusual tactics',{style:'balanced',preferred:400,cover:true,coverBelow:.8,evade:true,retreat:true,retreatBelow:.3,firePolicy:'inRange',explanation:'test'});
assert.equal(custom.plan.preferred,400);assert.equal(custom.plan.retreatBelow,.3);assert.ok(Number.isFinite(custom.x));
console.log(JSON.stringify({rush,sniper,custom},null,2));
