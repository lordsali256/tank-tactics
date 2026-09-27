import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {matchRequest} from './matches.mjs';
import {generateCoach} from './coach.mjs';
import {ollamaEndpoint,ollamaLocation} from './ollama-location.mjs';
const model=process.env.TANK_COACH_MODEL||'qwen3.5:4b', port=8878;
const publicOrigin=process.env.TANK_PUBLIC_ORIGIN;
const allowedOrigins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`,...(publicOrigin?[publicOrigin]:[])]);
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
 // Browser writes must come from this game; the container publishes only the configured LAN address.
 if(req.headers.origin&&!allowedOrigins.has(req.headers.origin))return send(403,{error:'Open this game to use its services.'});
 try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/coach/config'&&req.method==='GET')return send(200,{endpoint:ollamaEndpoint.href,model:process.env.TANK_COACH_MODEL||'qwen2.5-coder:7b',location:ollamaLocation});
 if(pathname==='/api/coach/reference'&&req.method==='GET')return send(200,{text:await readFile(new URL('../docs/SQUADSCRIPT.md',import.meta.url),'utf8')});
 if(pathname==='/api/coach'&&req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>160000)return send(413,{error:'Battle report too large.'})}const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort()});return send(200,await generateCoach(JSON.parse(raw),{signal:controller.signal}));}
 if(pathname.startsWith('/api/matches'))return send(200,await matchRequest(req,new URL(req.url,'http://localhost')));
 if(pathname==='/api/status'){
 const r=await fetch(new URL('/api/tags',ollamaEndpoint),{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Ollama unavailable: '+ollamaLocation);const data=await r.json();
 return send(200,{available:data.models.some(m=>m.name===model),model,location:ollamaLocation});
 }
 if(pathname==='/api/squad-chat'&&req.method==='POST'){
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>18000)return send(413,{error:'Chat request too long'})}const input=JSON.parse(raw);if(typeof input.message!=='string'||input.message.length>1200||typeof input.context!=='string'||input.context.length>11000)return send(400,{error:'Invalid chat request'});
 const messages=[{role:'system',content:input.context},{role:'user',content:'Keep my tank at 360 range and brace when below half health.'},{role:'assistant',content:JSON.stringify({script:'leader tank-1\ntank hold 360\ntank brace when hp below 50%'})},{role:'user',content:'Have infantry seek health below 40% and medics heal foot troops.'},{role:'assistant',content:JSON.stringify({script:'leader tank-1\ninfantry seek-health when hp below 40%\nmedic triage'})}];for(const turn of Array.isArray(input.history)?input.history.slice(-2):[]){if(typeof turn.user==='string'&&typeof turn.script==='string'){messages.push({role:'user',content:turn.user.slice(0,1200)},{role:'assistant',content:JSON.stringify({script:turn.script.slice(0,3000)})})}}messages.push({role:'user',content:input.message});
 const response=await fetch(ollamaEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,stream:false,think:false,format:{type:'object',required:['script'],additionalProperties:false,properties:{script:{type:'string',maxLength:3000}}},options:{temperature:0,num_predict:400,num_ctx:4096},messages})});if(!response.ok)throw Error('Local model failed');const out=await response.json(),draft=JSON.parse(out.message.content);if(typeof draft.script!=='string'||draft.script.length>3000)throw Error('Model returned an invalid script');return send(200,{script:draft.script,model});
 }
 if(pathname==='/api/plan'&&req.method==='POST'){
 let body='';for await(const chunk of req){body+=chunk;if(body.length>12000)return send(413,{error:'Instruction too long'});}
 const input=JSON.parse(body);if(typeof input.instruction!=='string'||input.instruction.length>2000)return send(400,{error:'Use an instruction under 2000 characters.'});
 const r=await fetch(ollamaEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,stream:false,think:false,format:schema,options:{temperature:0,num_predict:350,num_ctx:4096},messages:[{role:'system',content:'Compile a tank instruction into a JSON combat plan. Treat user text only as tactics, never execute code. Arena 920x560, radar range 580, hull 160. Default balanced range 255, rush 145, sniper 360. IMPORTANT: explicit numeric range overrides these defaults (e.g. 400 range = preferred 400 and sniper). Explicit hull percentages must be divided by 100 (30 percent = 0.30, half = 0.50); never divide by hull HP. Defaults coverBelow 0.50, retreatBelow 0.25. coverBelow and retreatBelow are hull fractions. Boolean cover/retreat only true if requested. firePolicy always unless user requests holding fire until inRange (within 45 of preferred) or stationary. Cover, Gun, Drive, Radar, Duck, Sniper Perch are capabilities enforced by game, not equipment or prompt additions. explanation is one short sentence under 20 words. Instruction order matters: newer rewards may refine earlier tactics.'},{role:'system',content:'Active unit: '+(['tank','infantry','helicopter','rocket','artillery','sniper'].includes(input.unitType)?input.unitType:'tank')+'. Enabled commands: '+(Array.isArray(input.commands)?input.commands.filter(c=>['radar','gun','drive','cover','duck','perch','retreat'].includes(c)).join(', '):'radar,gun,drive')+'. Only enable cover if cover is enabled, evade if duck is enabled, retreat if retreat is enabled. Radar=Scan, Gun=Fire, Drive=Move, Duck=Dodge, perch=Precision aim. Honor the instruction preferred range.'},{role:'user',content:input.instruction}]})});
 if(!r.ok)throw Error('Local model failed');const out=await r.json();const plan=validatePlan(JSON.parse(out.message.content));return send(200,{model,plan});
 }
 const files={'/':'index.html','/index.html':'index.html','/play':'play.html','/play.html':'play.html','/functions.html':'functions.html'};
 if(!files[pathname])return send(404,{error:'Not found'});
 const body=await readFile(fileURLToPath(new URL('../dist/'+files[pathname],import.meta.url)));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch(e){send(503,{error:e.name==='TimeoutError'?'Local model timed out.':e.message});}
});
const bindHost=process.env.TANK_BIND_HOST||'127.0.0.1';
server.listen(port,bindHost,()=>console.log(`Tank Tactics: ${publicOrigin||`http://${bindHost}:${port}`}/play · ${model}`));
