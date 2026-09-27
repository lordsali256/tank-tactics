import fs from 'node:fs';
import {build} from 'esbuild';
import vm from 'node:vm';
fs.mkdirSync('dist/server',{recursive:true});
const renderer=await build({entryPoints:['client/arena-3d.js'],bundle:true,format:'iife',platform:'browser',minify:true,write:false});
let page=fs.readFileSync('dist/play.html','utf8').replace(/\n<!-- WEBGL_RENDERER -->[\s\S]*?<!-- END_WEBGL_RENDERER -->/,'');
const language=fs.readFileSync('cloud/scoring.mjs','utf8').replace('export function','function')+'\n'+fs.readFileSync('client/squad-language.js','utf8')+'\n'+fs.readFileSync('client/python-parser.js','utf8')+'\n'+fs.readFileSync('client/python-runtime.js','utf8')+'\n'+fs.readFileSync('client/script-workshop.js','utf8')+'\n'+fs.readFileSync('client/field-depot.js','utf8')+'\n'+fs.readFileSync('client/battle-flow.js','utf8');
page=page.replace(/<!-- FIELD_DEPOT_CSS -->[\s\S]*?<!-- END_FIELD_DEPOT_CSS -->/,()=> '<!-- FIELD_DEPOT_CSS --><style>'+fs.readFileSync('client/field-depot.css','utf8')+'</style><!-- END_FIELD_DEPOT_CSS -->');
page=page.replace(/<!-- FIELD_DEPOT_HTML -->[\s\S]*?<!-- END_FIELD_DEPOT_HTML -->/,()=> '<!-- FIELD_DEPOT_HTML -->'+fs.readFileSync('client/field-depot.html','utf8')+'<!-- END_FIELD_DEPOT_HTML -->');
page=page.replace(/\/\/ SQUAD_LANGUAGE_START[\s\S]*?\/\/ SQUAD_LANGUAGE_END\n?/,'');
page=page.replace('const initial=selectedUnit();',()=> '// SQUAD_LANGUAGE_START\n'+language+'\n// SQUAD_LANGUAGE_END\nconst initial=selectedUnit();');
page=page.replace('</body>', ()=> '\n<!-- WEBGL_RENDERER -->\n<script>'+renderer.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>\n<!-- END_WEBGL_RENDERER -->\n</body>');
fs.writeFileSync('dist/play.html',page);
const source=fs.readFileSync('dist/play.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const prologue=`export function createEngine(a,b,map,initialSeed,restored=null){
const makeNode=()=>({textContent:'',value:'',style:{},children:[],classList:{remove(){},toggle(){}},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)},setAttribute(){},addEventListener(){},showModal(){},close(){},querySelector(){return null}});const nodes=new Map();const document={getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id)},createElement:makeNode,querySelectorAll(){return []}};const fakeCanvas=document.getElementById('arena');fakeCanvas.width=920;fakeCanvas.height=560;fakeCanvas.getContext=()=>({});const localStorage={getItem:()=>null,setItem(){},removeItem(){}};const window={};const performance={now:()=>0};const requestAnimationFrame=()=>{};const fetch=async()=>{throw Error('Model unavailable in multiplayer engine')};const confirm=()=>false;const setTimeout=()=>0;const clearTimeout=()=>{};
`;
const epilogue=`
roster=a;squadScript=a[0].squadScript||defaultSquadScript;$('prompt').value=squadScript;selectedId=a[0].id;campaign.map=map;round=1;commands=new Set(a[0].commands);$('prompt').value=a[0].instruction;compiledPlan=a[0].compiled;compiledText=a[0].instruction;resetPositions();battleUnits=battleUnits.filter(u=>u.team==='player');for(let i=0;i<b.length;i++){const t=spawnCombat(b[i],'player',i,b.length);t.team='enemy';t.x=W-80-Math.floor(i/6)*55;t.angle=Math.PI;t.heading=Math.PI;t.plan=planForUnit(b[i]);t.commands=b[i].commands;battleUnits.push(t)}enemy=battleUnits.find(u=>u.team==='enemy');seed=initialSeed;mode='running';finish=function(win){mode=win?'won':'lost'};
if(restored){battleUnits=restored.battleUnits;for(const t of battleUnits)t.target=battleUnits.find(u=>u.id===t.targetId)||null;shots=restored.shots;sparks=restored.sparks;pickups=restored.pickups;if(restored.buildings){buildings=restored.buildings;rocks.splice(0,rocks.length,...buildings.filter(b=>!b.destroyed));worldRevision++}elapsed=restored.elapsed;seed=restored.seed;mode=restored.mode;damageEvents=restored.damageEvents||[];player=battleUnits.find(u=>u.team==='player');enemy=battleUnits.find(u=>u.team==='enemy')}
return{tick(seconds){const steps=Math.max(0,Math.min(120,Math.floor(seconds*60)));for(let i=0;i<steps&&mode==='running';i++)update(1/60)},state(){return JSON.parse(JSON.stringify({mode,elapsed,seed,battleUnits:battleUnits.map(t=>({...t,target:null,targetId:t.target?.id||null})),shots,sparks,pickups,buildings,damageEvents},(key,value)=>key==='target'?undefined:value))}};
}
`;
fs.writeFileSync('dist/server/engine.mjs',prologue+source+epilogue.replace('t.angle=Math.PI;t.heading=Math.PI;','t.homeX=t.x;t.homeY=t.y;t.angle=Math.PI;t.heading=Math.PI;'));
const baseCatalog=vm.runInNewContext(fs.readFileSync('client/squad-language.js','utf8').match(/const squadFunctions=([\s\S]*?)\.map\(/)[1]);
const pythonRuntime=fs.readFileSync('client/python-runtime.js','utf8'),extraCatalog=vm.runInNewContext(pythonRuntime.match(/const extraPythonActions=([\s\S]*?);/)[1]);
const readSet=name=>[...vm.runInNewContext(pythonRuntime.match(new RegExp('const '+name+'=(new Set\\([\\s\\S]*?\\));'))[1])];
const methods=[...readSet('pythonCore'),...baseCatalog.concat(extraCatalog).map(row=>row[1].replaceAll('-','_'))];
fs.writeFileSync('cloud/python-policy.mjs',fs.readFileSync('client/python-parser.js','utf8')+'\nconst methods=new Set('+JSON.stringify(methods)+'),sensors=new Set('+JSON.stringify(readSet('pythonSensors'))+'),queries=new Set('+JSON.stringify(readSet('pythonQueries'))+');\nexport function validatePython(text){const result=PythonUnit.compile(text,methods,sensors,queries);if(result.errors.length)throw Error(result.errors.join(" · "));return text}\n');
fs.copyFileSync('cloud/worker.mjs','dist/server/index.js');
const bundled=await build({entryPoints:['dist/server/index.js'],bundle:true,format:'esm',platform:'browser',write:false});
fs.writeFileSync('dist/server/index.js',bundled.outputFiles[0].contents);
fs.mkdirSync('dist/client',{recursive:true});
for(const file of ['index.html','play.html','functions.html'])fs.copyFileSync('dist/'+file,'dist/client/'+file);

