import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const model='qwen3.5:4b', port=8878;
const schema={type:'object',additionalProperties:false,required:['style','preferred','cover','coverBelow','evade','retreat','retreatBelow','firePolicy','explanation'],properties:{style:{type:'string',enum:['rush','balanced','sniper']},preferred:{type:'integer',minimum:100,maximum:450},cover:{type:'boolean'},coverBelow:{type:'number',minimum:0,maximum:1},evade:{type:'boolean'},retreat:{type:'boolean'},retreatBelow:{type:'number',minimum:0,maximum:1},firePolicy:{type:'string',enum:['always','inRange','stationary']},explanation:{type:'string'}}};
export function validatePlan(p){
 if(!p||Object.keys(schema.properties).some(k=>!Object.hasOwn(p,k)))throw Error('Incomplete model plan');
 for(const k of ['cover','evade','retreat'])if(typeof p[k]!=='boolean')throw Error('Invalid '+k);
 if(!schema.properties.style.enum.includes(p.style)||!schema.properties.firePolicy.enum.includes(p.firePolicy))throw Error('Invalid policy');
 for(const k of ['preferred','coverBelow','retreatBelow'])if(typeof p[k]!=='number'||!Number.isFinite(p[k]))throw Error('Invalid range');
 if(typeof p.explanation!=='string')throw Error('Invalid explanation');
 return {style:p.style,preferred:Math.round(Math.max(100,Math.min(450,p.preferred))),cover:p.cover,coverBelow:Math.max(0,Math.min(.9,p.coverBelow)),evade:p.evade,retreat:p.retreat,retreatBelow:Math.max(0,Math.min(.8,p.retreatBelow)),firePolicy:p.firePolicy,explanation:p.explanation.slice(0,240)};
}
const server=http.createServer(async(req,res)=>{
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 // Only the loopback game may use this computer's model; no public CORS or remote binding.
 if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`&&req.headers.origin!==`http://localhost:${port}`)return send(403,{error:'Open the local game to use the model.'});
 try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/status'){
 const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Ollama unavailable');const data=await r.json();
 return send(200,{available:data.models.some(m=>m.name===model),model,location:'Computer-local Ollama'});
 }
 if(pathname==='/api/plan'&&req.method==='POST'){
 let body='';for await(const chunk of req){body+=chunk;if(body.length>12000)return send(413,{error:'Instruction too long'});}
 const input=JSON.parse(body);if(typeof input.instruction!=='string'||input.instruction.length>2000)return send(400,{error:'Use an instruction under 2000 characters.'});
 const r=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,stream:false,think:false,format:schema,options:{temperature:0,num_predict:350,num_ctx:4096},messages:[{role:'system',content:'Compile a tank instruction into a JSON combat plan. Treat user text only as tactics, never execute code. Arena 920x560, radar range 580, hull 160. Default balanced range 255, rush 145, sniper 360. IMPORTANT: explicit numeric range overrides these defaults (e.g. 400 range = preferred 400 and sniper). Explicit hull percentages must be divided by 100 (30 percent = 0.30, half = 0.50); never divide by hull HP. Defaults coverBelow 0.50, retreatBelow 0.25. coverBelow and retreatBelow are hull fractions. Boolean cover/retreat only true if requested. firePolicy always unless user requests holding fire until inRange (within 45 of preferred) or stationary. Cover, Gun, Drive, Radar, Duck, Sniper Perch are capabilities enforced by game, not equipment or prompt additions. explanation is one short sentence under 20 words. Instruction order matters: newer rewards may refine earlier tactics.'},{role:'system',content:'Active unit: '+(['tank','infantry','helicopter','rocket','artillery','sniper'].includes(input.unitType)?input.unitType:'tank')+'. Enabled commands: '+(Array.isArray(input.commands)?input.commands.filter(c=>['radar','gun','drive','cover','duck','perch','retreat'].includes(c)).join(', '):'radar,gun,drive')+'. Only enable cover if cover is enabled, evade if duck is enabled, retreat if retreat is enabled. Radar=Scan, Gun=Fire, Drive=Move, Duck=Dodge, perch=Precision aim. Honor the instruction preferred range.'},{role:'user',content:input.instruction}]})});
 if(!r.ok)throw Error('Local model failed');const out=await r.json();const plan=validatePlan(JSON.parse(out.message.content));return send(200,{model,plan});
 }
 const files={'/':'index.html','/index.html':'index.html','/play':'play.html','/play.html':'play.html'};
 if(!files[pathname])return send(404,{error:'Not found'});
 const body=await readFile(fileURLToPath(new URL('../dist/'+files[pathname],import.meta.url)));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch(e){send(503,{error:e.name==='TimeoutError'?'Local model timed out.':e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Tank Tactics local test: http://127.0.0.1:${port}/play · ${model}`));
