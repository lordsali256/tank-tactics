import fs from 'node:fs';
import {build} from 'esbuild';
fs.mkdirSync('dist/server',{recursive:true});
const source=fs.readFileSync('dist/play.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const prologue=`export function createEngine(a,b,map,initialSeed,restored=null){
const makeNode=()=>({textContent:'',value:'',style:{},children:[],classList:{remove(){},toggle(){}},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)},setAttribute(){},addEventListener(){},showModal(){},close(){},querySelector(){return null}});const nodes=new Map();const document={getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id)},createElement:makeNode,querySelectorAll(){return []}};const fakeCanvas=document.getElementById('arena');fakeCanvas.width=920;fakeCanvas.height=560;fakeCanvas.getContext=()=>({});const localStorage={getItem:()=>null,setItem(){},removeItem(){}};const window={};const performance={now:()=>0};const requestAnimationFrame=()=>{};const fetch=async()=>{throw Error('Model unavailable in multiplayer engine')};const confirm=()=>false;const setTimeout=()=>0;const clearTimeout=()=>{};
`;
const epilogue=`
roster=a;selectedId=a[0].id;campaign.map=map;round=1;commands=new Set(a[0].commands);$('prompt').value=a[0].instruction;compiledPlan=a[0].compiled;compiledText=a[0].instruction;resetPositions();battleUnits=battleUnits.filter(u=>u.team==='player');for(let i=0;i<b.length;i++){const t=spawnCombat(b[i],'player',i,b.length);t.team='enemy';t.x=840-Math.floor(i/6)*55;t.angle=Math.PI;t.heading=Math.PI;t.plan=planForUnit(b[i]);t.commands=b[i].commands;battleUnits.push(t)}enemy=battleUnits.find(u=>u.team==='enemy');seed=initialSeed;mode='running';finish=function(win){mode=win?'won':'lost'};
if(restored){battleUnits=restored.battleUnits;for(const t of battleUnits)t.target=battleUnits.find(u=>u.id===t.targetId)||null;shots=restored.shots;sparks=restored.sparks;pickups=restored.pickups;elapsed=restored.elapsed;seed=restored.seed;mode=restored.mode;damageEvents=restored.damageEvents||[];player=battleUnits.find(u=>u.team==='player');enemy=battleUnits.find(u=>u.team==='enemy')}
return{tick(seconds){const steps=Math.max(0,Math.min(120,Math.floor(seconds*60)));for(let i=0;i<steps&&mode==='running';i++)update(1/60)},state(){return JSON.parse(JSON.stringify({mode,elapsed,seed,battleUnits:battleUnits.map(t=>({...t,target:null,targetId:t.target?.id||null})),shots,sparks,pickups,damageEvents},(key,value)=>key==='target'?undefined:value))}};
}
`;
fs.writeFileSync('dist/server/engine.mjs',prologue+source+epilogue);
fs.copyFileSync('cloud/worker.mjs','dist/server/index.js');
const bundled=await build({entryPoints:['dist/server/index.js'],bundle:true,format:'esm',platform:'browser',write:false});
fs.writeFileSync('dist/server/index.js',bundled.outputFiles[0].contents);
fs.mkdirSync('dist/client',{recursive:true});
for(const file of ['index.html','play.html'])fs.copyFileSync('dist/'+file,'dist/client/'+file);
